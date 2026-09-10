import { authkitMiddleware } from '@workos-inc/authkit-nextjs'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { bearerToken, verifyBearerToken } from '@/lib/access'

const refreshSession = authkitMiddleware()

// Vercel cron targets (mirrors `crons` in vercel.json). These carry
// `Authorization: Bearer ${CRON_SECRET}` — a shared secret, not a WorkOS JWT —
// so the Bearer gate below must not try to verify it. Each handler does its own
// constant-time secret check before doing anything.
const CRON_PATHS = ['/api/notifications/run']

/**
 * Refreshes the sealed AuthKit session cookie while leaving every page public.
 *
 * This app never uses WorkOS's hosted AuthKit UI — Google goes straight to
 * Google's consent screen and email uses magic-auth codes, both via
 * `app/api/auth/*`, both calling `saveSession()` directly (see lib/access.ts's
 * header comment). That means the library's built-in `middlewareAuth` option
 * doesn't fit here: enabling it redirects signed-out visitors to WorkOS's
 * hosted authorize URL, not to this app's own `/sign-in` page, and this app
 * has no route handler at the redirect URI it would need. Authentication is
 * therefore initiated explicitly from the app's own sign-in page.
 *
 * Every API route
 * resolves its own auth via `lib/access.ts::getAuth`, which falls back to
 * the read-only demo user (`DEMO_USER_ID`) for anyone with *no* credential
 * at all. That stays as-is — it's the fallback for API callers that bypass
 * the browser (tests, curl, direct requests, or a signed-out web visitor).
 * This lets every page render the read-only demo experience without a session.
 *
 * One exception: a request that *does* carry a Bearer token (the mobile
 * app's normal case — it always sends one once signed in) but whose token
 * fails WorkOS verification is 401'd right here, before it ever reaches a
 * route handler. That case is a broken real session (expired refresh,
 * revoked elsewhere, clock skew), not a guest — letting it fall through to
 * `getAuth`'s demo fallback would silently render the demo account's data
 * under a real, still-appears-signed-in user with no error anywhere. The
 * mobile client already has 401-triggered logout wired up
 * (`app/_layout.tsx`'s query-cache listener); this is what feeds it. The cron
 * paths are exempt from that gate — see `CRON_PATHS` above.
 */
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = await refreshSession(request, event)

  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/')) {
    const token = (pathname.startsWith('/api/cron/') || CRON_PATHS.includes(pathname)) ? null : bearerToken(request)
    if (token && !(await verifyBearerToken(token))) {
      return NextResponse.json({ error: 'invalid or expired session' }, { status: 401 })
    }
    return response
  }

  return response
}

export const config = {
  // Everything except static assets, so /api/* route handlers see a fresh session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
}
