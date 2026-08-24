import { NextResponse } from 'next/server'
import { getWorkOSClient } from '@/lib/workosClient'
import { generateNonce, setStateCookie } from '@/lib/oauthState'

/**
 * Skips the AuthKit picker entirely — straight to Google's consent screen.
 * `?link=1` marks this as an account-linking attempt from an already
 * signed-in user, rather than a fresh sign-in — see the callback route.
 *
 * `state` carries a random nonce (not just the literal 'link'/undefined it
 * used to be) that the callback checks against a short-lived cookie set here
 * — see lib/oauthState.ts for why.
 */
export async function GET(req: Request) {
  const link = new URL(req.url).searchParams.get('link') === '1'
  const nonce = generateNonce()
  const state = link ? `link:${nonce}` : nonce

  const url = getWorkOSClient().userManagement.getAuthorizationUrl({
    provider: 'GoogleOAuth',
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: new URL('/api/auth/google/callback', req.url).toString(),
    state,
  })

  const res = NextResponse.redirect(url)
  setStateCookie(res, nonce, req)
  return res
}
