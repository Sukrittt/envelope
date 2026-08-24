import { json, error, readBody, EMAIL_RE } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { getWorkOSClient } from '@/lib/workosClient'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

/**
 * Changes the account email. WorkOS has no pending-email concept — the change
 * commits immediately and flips `emailVerified` to false, so callers must show
 * an unverified state until POST /api/user/email/verify succeeds.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email)) return error('valid email required')

  const workos = getWorkOSClient()
  const existing = await workos.userManagement.listUsers({ email, limit: 1 })
  if (existing.data.some((u) => u.id !== auth.userId)) {
    return error('That email is already in use.', 409)
  }

  await workos.userManagement.updateUser({ userId: auth.userId, email })
  await workos.userManagement.sendVerificationEmail({ userId: auth.userId })

  const db = await getDb()
  await db.collection<UserDoc>('users').updateOne({ _id: auth.userId }, { $set: { email, emailVerified: false } })

  return json({ email, emailVerified: false })
}
