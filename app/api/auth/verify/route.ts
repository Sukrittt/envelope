import { json, error } from '@/lib/http'
import { isAuthorized } from '@/lib/access'

export const dynamic = 'force-dynamic'

// Unlike the data routes, this must reject a wrong/missing token outright —
// they intentionally fall back to guest scope (200 + demo data) so the app
// stays usable without a token, which makes them unusable for verifying a
// password against the mobile unlock screen.
export async function GET(req: Request) {
  if (!isAuthorized(req)) return error('unauthorized', 401)
  return json({ ok: true })
}
