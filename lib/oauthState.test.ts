import { describe, it, expect } from 'vitest'
import { generateNonce, verifyState, OAUTH_STATE_COOKIE } from './oauthState'

function reqWithCookie(cookie: string | null): Request {
  const headers = new Headers()
  if (cookie !== null) headers.set('cookie', cookie)
  return new Request('https://example.com/api/auth/google/callback', { headers })
}

describe('verifyState', () => {
  it('accepts a matching bare nonce as a fresh sign-in', () => {
    const nonce = generateNonce()
    const req = reqWithCookie(`${OAUTH_STATE_COOKIE}=${nonce}`)
    expect(verifyState(req, nonce)).toEqual({ isLink: false })
  })

  it('accepts a matching link: nonce as an account-linking attempt', () => {
    const nonce = generateNonce()
    const req = reqWithCookie(`${OAUTH_STATE_COOKIE}=${nonce}`)
    expect(verifyState(req, `link:${nonce}`)).toEqual({ isLink: true })
  })

  it('rejects when there is no cookie at all (attacker-crafted callback link)', () => {
    const nonce = generateNonce()
    const req = reqWithCookie(null)
    expect(verifyState(req, nonce)).toBeNull()
  })

  it('rejects when the state param does not match the cookie', () => {
    const req = reqWithCookie(`${OAUTH_STATE_COOKIE}=${generateNonce()}`)
    expect(verifyState(req, generateNonce())).toBeNull()
  })

  it('rejects an empty state param', () => {
    const req = reqWithCookie(`${OAUTH_STATE_COOKIE}=${generateNonce()}`)
    expect(verifyState(req, '')).toBeNull()
  })

  it('rejects when another cookie is present but not ours', () => {
    const req = reqWithCookie('other=1234')
    expect(verifyState(req, 'anything')).toBeNull()
  })
})
