import { json, error, readBody } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { getWorkOSClient } from '@/lib/workosClient'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = (await readBody(req)) as Record<string, unknown>
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) return error('code required')

  try {
    const { user } = await getWorkOSClient().userManagement.verifyEmail({ userId: auth.userId, code })
    const db = await getDb()
    await db.collection<UserDoc>('users').updateOne({ _id: auth.userId }, { $set: { emailVerified: user.emailVerified } })
    return json({ emailVerified: user.emailVerified })
  } catch {
    return error('invalid or expired code', 401)
  }
}
