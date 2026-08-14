import { json, error, readBody } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'
import { registerPushToken } from '@/lib/push'

export const dynamic = 'force-dynamic'

function isPlatform(v: unknown): v is 'ios' | 'android' {
  return v === 'ios' || v === 'android'
}

export async function POST(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const token = body.token
  const platform = body.platform
  if (typeof token !== 'string' || !token) return error('token required')
  if (!isPlatform(platform)) return error('platform required')

  await registerPushToken(token, platform)
  return json({ ok: true })
}
