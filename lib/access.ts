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
 * Resolve the owner of a request.
 *
 * 1. `Authorization: Bearer <jwt>` — the mobile app, which holds a WorkOS
 *    access token directly.
 * 2. The AuthKit session cookie — the web app, same-origin, so the token
 *    itself never reaches browser JavaScript.
 * 3. Neither — the demo user, read-only.
 *
 * A token that fails verification falls through to demo rather than 401ing,
 * matching the pre-WorkOS behaviour where data routes always answered 200.
 * Verification failures are logged so a broken key never looks like empty data.
 */
export async function getAuth(req: Request): Promise<Auth> {
  const token = bearerToken(req)
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer: 'https://api.workos.com/',
      })
      if (payload.sub) {
        return { userId: payload.sub, readOnly: false, sessionId: typeof payload.sid === 'string' ? payload.sid : null }
      }
    } catch (err) {
      console.warn('[auth] access token rejected:', (err as Error).message)
    }
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
