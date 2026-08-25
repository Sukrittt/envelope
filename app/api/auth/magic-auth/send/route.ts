import { json, error, readBody, EMAIL_RE } from '@/lib/http'
import { getWorkOSClient } from '@/lib/workosClient'
import { isRateLimited, clientIp } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const PER_EMAIL_LIMIT = 5
const PER_IP_LIMIT = 20
const BURST_WINDOW_MS = 60 * 1000
const BURST_PER_EMAIL_LIMIT = 2
const BURST_PER_IP_LIMIT = 5

export async function POST(req: Request) {
  const body = await readBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email)) return error('a valid email is required')

  const [emailLimited, ipLimited] = await Promise.all([
    isRateLimited(`magic-auth-send:email:${email}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_PER_EMAIL_LIMIT },
      { windowMs: WINDOW_MS, limit: PER_EMAIL_LIMIT },
    ]),
    isRateLimited(`magic-auth-send:ip:${clientIp(req)}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_PER_IP_LIMIT },
      { windowMs: WINDOW_MS, limit: PER_IP_LIMIT },
    ]),
  ])
  if (emailLimited || ipLimited) return error('rate limited', 429)

  await getWorkOSClient().userManagement.createMagicAuth({ email })
  return json({ ok: true })
}
