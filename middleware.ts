import { authkitMiddleware } from '@workos-inc/authkit-nextjs'

/**
 * Refreshes the sealed AuthKit session cookie. Deliberately configured without
 * `middlewareAuth`, so it never forces a sign-in: signed-out visitors are served
 * as the read-only demo user rather than bounced to a login page.
 */
export default authkitMiddleware()

export const config = {
  // Everything except static assets, so /api/* route handlers see a fresh session.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
}
