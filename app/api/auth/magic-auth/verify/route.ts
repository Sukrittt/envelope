import { NextResponse } from 'next/server'
import { saveSession } from '@workos-inc/authkit-nextjs'
import { getWorkOSClient } from '@/lib/workosClient'
import { ensureUser } from '@/lib/users'
import { readBody, EMAIL_RE } from '@/lib/http'
import { isRateLimited, clientIp } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const PER_EMAIL_LIMIT = 10
const PER_IP_LIMIT = 30
const BURST_WINDOW_MS = 60 * 1000
const BURST_PER_EMAIL_LIMIT = 5
const BURST_PER_IP_LIMIT = 10

/**
 * Shared by both clients: web relies on the cookie saveSession() sets;
 * mobile has no cookie jar, so the tokens ride along in the JSON body too.
 */
export async function POST(req: Request) {
  const body = await readBody(req)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const device = body.device
  if (!email || !EMAIL_RE.test(email) || !code)
    return NextResponse.json({ error: 'email and code required' }, { status: 400 })

  const [emailLimited, ipLimited] = await Promise.all([
    isRateLimited(`magic-auth-verify:email:${email}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_PER_EMAIL_LIMIT },
      { windowMs: WINDOW_MS, limit: PER_EMAIL_LIMIT },
    ]),
    isRateLimited(`magic-auth-verify:ip:${clientIp(req)}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_PER_IP_LIMIT },
      { windowMs: WINDOW_MS, limit: PER_IP_LIMIT },
    ]),
  ])
  if (emailLimited || ipLimited) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  // `device` is the RN app's own label (expo-device); it identifies the phone
  // far better than the generic RN fetch user-agent string would.
  const userAgent = typeof device === 'string' && device ? device : req.headers.get('user-agent') ?? undefined

  try {
    const { user, accessToken, refreshToken } = await getWorkOSClient().userManagement.authenticateWithMagicAuth({
      clientId: process.env.WORKOS_CLIENT_ID!,
      email,
      code,
      userAgent,
    })
    await ensureUser(user)
    await saveSession({ accessToken, refreshToken, user }, req.url)
    return NextResponse.json({ ok: true, accessToken, refreshToken })
  } catch {
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 401 })
  }
}
