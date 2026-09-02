import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { scoped } from '@/lib/scoped'
import { COLLECTIONS } from '@/lib/models'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

/**
 * Undo a soft-deleted account within its grace window (see DELETE /api/user
 * and app/api/cron/gc/route.ts). Restores every collection's rows an
 * unfiltered `deleteMany({})` archived, then clears the account itself.
 * A 404 (rather than a silent no-op) means either the account was never
 * deleted or the GC cron already purged it — the grace window is over.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const db = await getDb()
  const account = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
  if (!account?.deleted_at) return error('account is not scheduled for deletion', 404)

  for (const name of Object.values(COLLECTIONS)) {
    await scoped(db.collection(name), auth.userId).restore({})
  }
  await db.collection<UserDoc>('users').updateOne({ _id: auth.userId }, { $set: { deleted_at: null } })

  return json({ ok: true })
}
