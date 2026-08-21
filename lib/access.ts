import { NextResponse } from 'next/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { withAuth } from '@workos-inc/authkit-nextjs'

/**
 * Who a request belongs to. `userId` is the WorkOS user id (`user_…`) taken
 * from a verified access token, or `DEMO_USER_ID` for anyone signed out.
 * `readOnly` marks the demo user, whose data is public sample data.
 */
export interface Auth {
  userId: string
  readOnly: boolean
  /** The WorkOS session id (`sid`), when resolved from a real session. Null for the demo user. */
  sessionId: string | null
}

/** The user id every unauthenticated request is served as. */
export function demoUserId(): string {
  return process.env.DEMO_USER_ID || 'demo'
}

/**
 * WorkOS signs access tokens asymmetrically, so verification is a local
 * signature check against their published JWKS — no API call per request.
 * `createRemoteJWKSet` fetches once and caches the key set in-process, so this
 * is built lazily and reused rather than rebuilt per request.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`),
    )
  }
  return jwks
}

/** The Bearer token from a request's Authorization header, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/**
 * Verify a WorkOS access token against their JWKS. Returns the resolved
 * identity, or null if the token is missing/expired/malformed/revoked.
 * Shared by `getAuth` (below) and `middleware.ts`, which uses it to 401 a
 * mobile request carrying a dead token before it ever reaches a route
 * handler — see that file for why that case must NOT fall through to demo.
 */
export async function verifyBearerToken(
  token: string,
): Promise<{ userId: string; sessionId: string | null } | null> {
  try {
    // WorkOS issues access tokens with iss "https://api.workos.com" — no
    // trailing slash. A stray slash here made every real token fail
    // verification (confirmed via Vercel logs: 100% of requests hit this),
    // silently masked by the demo-fallback this file used to have.
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: 'https://api.workos.com',
    })
    if (!payload.sub) return null
    return { userId: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : null }
  } catch (err) {
    console.warn('[auth] access token rejected:', (err as Error).message)
    return null
  }
}

/**
 * Resolve the owner of a request.
 *
 * 1. `Authorization: Bearer <jwt>` — the mobile app, which holds a WorkOS
 *    access token directly.
 * 2. The AuthKit session cookie — the web app, same-origin, so the token
 *    itself never reaches browser JavaScript.
 * 3. Neither — the demo user, read-only.
 *
 * A *missing* credential falls through to demo (anonymous browsing). A
 * Bearer token that's present but fails verification does NOT reach this
 * function in practice — `middleware.ts` 401s it first, since that case is a
 * broken real session, not a guest. This still checks it too (defence in
 * depth for any caller that bypasses middleware), falling through to demo
 * rather than throwing, matching the pre-WorkOS behaviour where data routes
 * always answered 200.
 */
export async function getAuth(req: Request): Promise<Auth> {
  const token = bearerToken(req)
  if (token) {
    const resolved = await verifyBearerToken(token)
    if (resolved) return { userId: resolved.userId, readOnly: false, sessionId: resolved.sessionId }
  }

  try {
    const { user, sessionId } = await withAuth()
    if (user) return { userId: user.id, readOnly: false, sessionId: sessionId ?? null }
  } catch {
    // No session cookie, or called outside a request scope — fall through.
  }

  return { userId: demoUserId(), readOnly: true, sessionId: null }
}

/** 403 response used for any write attempt by the read-only demo user. */
export function readOnlyResponse(): NextResponse {
  return NextResponse.json({ error: 'read-only in demo mode' }, { status: 403 })
}

/**
 * Return a 403 response when the read-only demo user tries a non-GET, else
 * null. Demo can read the sample account but never write to it.
 */
export function readOnlyGuard(auth: Auth, method: string): NextResponse | null {
  if (auth.readOnly && method !== 'GET') return readOnlyResponse()
  return null
}
