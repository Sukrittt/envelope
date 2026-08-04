import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

export type Scope = 'real' | 'guest'

const DEMO_PREFIX = 'demo_'

/**
 * Shared secret for the API. Same value as the AuthGate password
 * (`NEXT_PUBLIC_DASHBOARD_PASSWORD`), so the Telegram bot — and the dashboard
 * itself — authenticate with the same password used to unlock real mode.
 * When no password is configured the API is open, matching the gate, which
 * auto-unlocks to real mode.
 */
const EXPECTED_TOKEN = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD as string | undefined

/** Constant-time string comparison, normalizing length via SHA-256. */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

/** The Bearer token from a request's Authorization header, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/** True when the request carries a valid Bearer token (or no password is set). */
export function isAuthorized(req: Request): boolean {
  if (!EXPECTED_TOKEN) return true
  const token = bearerToken(req)
  return token !== null && safeEqual(token, EXPECTED_TOKEN)
}

/**
 * Resolve the request scope from its Bearer token. A valid token grants
 * 'real' (live data, read-write); anything else falls back to the read-only
 * guest/demo scope. The `?mode=guest` query param is no longer consulted —
 * presence of the token is the only signal.
 */
export function getScope(req: Request): Scope {
  return isAuthorized(req) ? 'real' : 'guest'
}

/**
 * Map a base collection name to the collection actually used for a scope.
 * Guest mode reads from the read-only `demo_*` collections.
 */
export function resolveCollection(base: string, scope: Scope): string {
  return scope === 'guest' ? `${DEMO_PREFIX}${base}` : base
}

/** 403 response used for any write attempt in guest (read-only demo) mode. */
export function readOnlyResponse(): NextResponse {
  return NextResponse.json({ error: 'read-only in guest mode' }, { status: 403 })
}

/**
 * Return a 403 response when a guest scope tries a non-GET mutation, else null.
 * Guests (no valid Bearer token) can read demo data but never write.
 */
export function guestWriteGuard(scope: Scope, method: string): NextResponse | null {
  if (scope === 'guest' && method !== 'GET') {
    return readOnlyResponse()
  }
  return null
}
