import { json, error } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { getWorkOSClient } from '@/lib/workosClient'
import { isRateLimited } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const RATE_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT = 5

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  if (await isRateLimited(`user-email-resend:${auth.userId}`, { windowMs: RATE_WINDOW_MS, limit: RATE_LIMIT })) {
    return error('rate limited', 429)
  }

  await getWorkOSClient().userManagement.sendVerificationEmail({ userId: auth.userId })
  return json({ ok: true })
}
