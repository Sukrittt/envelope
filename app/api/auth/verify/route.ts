import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'

export const dynamic = 'force-dynamic'

// Unlike the data routes, this must reject a missing/invalid session outright —
// they intentionally fall back to the read-only demo user (200 + sample data) so
// the app stays usable signed out, which makes them useless for the mobile app's
// "is my stored token still good?" check.
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)
  return json({ ok: true, userId: auth.userId })
}
