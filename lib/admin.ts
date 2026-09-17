import 'server-only'
import { notFound } from 'next/navigation'
import { withAuth } from '@workos-inc/authkit-nextjs'
import { getDb } from './mongodb'
import type { UserDoc } from './users'

// Admin pages read `db.collection()` directly, bypassing lib/scoped.ts on
// purpose: they are cross-tenant by design. Keep them to metadata and counts —
// never read encrypted fields.

/**
 * The signed-in admin's user id, or null. Admin = a live `users` doc with
 * `isAdmin: true` (granted only via scripts/grant-admin.mjs). Checked against
 * the DB on every call, so revoking takes effect immediately.
 */
export async function adminUserId(): Promise<string | null> {
  let userId: string | undefined
  try {
    userId = (await withAuth()).user?.id
  } catch {
    return null
  }
  if (!userId) return null

  const db = await getDb()
  const doc = await db
    .collection<UserDoc>('users')
    .findOne({ _id: userId, isAdmin: true, deleted_at: null }, { projection: { _id: 1 } })
  return doc ? userId : null
}

/**
 * Gate for every /admin page and server action. Non-admins (and signed-out
 * visitors) get a plain 404, so the route looks like it doesn't exist.
 */
export async function requireAdmin(): Promise<string> {
  const id = await adminUserId()
  if (!id) notFound()
  return id
}
