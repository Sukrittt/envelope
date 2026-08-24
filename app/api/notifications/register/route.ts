import { json, error, readBody } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { registerPushToken } from '@/lib/push'

export const dynamic = 'force-dynamic'

function isPlatform(v: unknown): v is 'ios' | 'android' {
  return v === 'ios' || v === 'android'
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const token = body.token
  const platform = body.platform
  if (typeof token !== 'string' || !token) return error('token required')
  if (!isPlatform(platform)) return error('platform required')

  try {
    await registerPushToken(token, platform, auth.userId)
  } catch {
    return error('invalid push token')
  }
  return json({ ok: true })
}
