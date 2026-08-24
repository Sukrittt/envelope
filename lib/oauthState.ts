import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextResponse } from 'next/server'

/**
 * CSRF protection for the hand-rolled Google OAuth flow in app/api/auth/google.
 * That flow bypasses WorkOS's own PKCE/state machinery (no hosted AuthKit
 * page), so `state` has no built-in verification — without this, a crafted
 * link straight to the callback with an attacker's own `code` would silently
 * sign a victim into the attacker's account (login CSRF).
 */
export const OAUTH_STATE_COOKIE = 'oauth_state'

export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

export function setStateCookie(res: NextResponse, nonce: string, req: Request): void {
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: new URL(req.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge: 300,
  })
}

export function clearStateCookie(res: NextResponse): void {
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 })
}

/** Reads one cookie by name from a request's Cookie header. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/**
 * Verifies the `state` query param against the cookie set by the initiating
 * request. `state` is either a bare nonce (fresh sign-in) or `link:<nonce>`
 * (account-linking attempt — see app/api/auth/google/route.ts). Returns
 * `{ isLink }` on success, or null when the state doesn't match — including
 * when either half is missing.
 */
export function verifyState(req: Request, state: string): { isLink: boolean } | null {
  const isLink = state.startsWith('link:')
  const nonce = isLink ? state.slice('link:'.length) : state
  const cookieNonce = readCookie(req, OAUTH_STATE_COOKIE)
  if (!cookieNonce || !nonce || !safeEqual(cookieNonce, nonce)) return null
  return { isLink }
}
