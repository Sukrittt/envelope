import type { Db } from 'mongodb'
import { del, list } from '@vercel/blob'
import { nowIST } from './http'
import { scoped } from './scoped'
import { COLLECTIONS } from './models'
import type { UserDoc } from './users'
import { getWorkOSClient } from './workosClient'

/**
 * Soft-deletes an account: archives every row (lib/scoped.ts `deleted_at`)
 * and marks the user. The GC cron (app/api/cron/gc) purges both, and the
 * WorkOS user, once `GRACE_DAYS` pass. Returns the deletion timestamp.
 */
export async function softDeleteAccount(db: Db, userId: string): Promise<string> {
  for (const name of Object.values(COLLECTIONS)) {
    await scoped(db.collection(name), userId).deleteMany({})
  }
  const deletedAt = nowIST().timestamp
  await db.collection<UserDoc>('users').updateOne({ _id: userId }, { $set: { deleted_at: deletedAt } })
  return deletedAt
}

/** Undoes `softDeleteAccount` within the grace window. */
export async function restoreAccount(db: Db, userId: string): Promise<void> {
  for (const name of Object.values(COLLECTIONS)) {
    await scoped(db.collection(name), userId).restore({})
  }
  await db.collection<UserDoc>('users').updateOne({ _id: userId }, { $set: { deleted_at: null } })
}

/** Per-user collections outside COLLECTIONS that still carry `user_id`. */
const EXTRA_USER_COLLECTIONS = ['notification_threshold_state', 'ai_usage']

/**
 * Irreversible, immediate account purge (admin only): WorkOS user, every
 * row with this `user_id` (live or archived), stored bill-scan images and
 * exports in Vercel Blob, then the `users` doc. WorkOS goes first, like the
 * GC cron, so a failure there leaves everything intact to retry.
 */
export async function purgeAccountNow(db: Db, userId: string): Promise<{ rows: number; blobs: number }> {
  try {
    await getWorkOSClient().userManagement.deleteUser(userId)
  } catch (err) {
    // Already gone from WorkOS (e.g. a half-finished earlier purge) — carry on with local cleanup.
    if ((err as { status?: number }).status !== 404) throw err
  }

  let rows = 0
  for (const name of [...Object.values(COLLECTIONS), ...EXTRA_USER_COLLECTIONS]) {
    rows += (await db.collection(name).deleteMany({ user_id: userId })).deletedCount
  }

  let blobs = 0
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (const prefix of [`bills/${userId}/`, `exports/${userId}/`]) {
      let cursor: string | undefined
      do {
        const page = await list({ prefix, cursor })
        if (page.blobs.length) await del(page.blobs.map((b) => b.url))
        blobs += page.blobs.length
        cursor = page.hasMore ? page.cursor : undefined
      } while (cursor)
    }
  }

  // The trial record goes with the account. `billing_subscriptions` rows stay:
  // they hold store transaction ids and dates, no budgeting content, and are
  // what lets a late refund or renewal event be matched to a purchase.
  await db.collection('billing_accounts').deleteOne({ _id: userId as never })

  await db.collection<UserDoc>('users').deleteOne({ _id: userId })
  return { rows, blobs }
}
