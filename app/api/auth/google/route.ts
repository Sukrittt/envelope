import { redirect } from 'next/navigation'
import { getWorkOSClient } from '@/lib/workosClient'

/**
 * Skips the AuthKit picker entirely — straight to Google's consent screen.
 * `?link=1` marks this as an account-linking attempt from an already
 * signed-in user, rather than a fresh sign-in — see the callback route.
 */
export async function GET(req: Request) {
  const link = new URL(req.url).searchParams.get('link') === '1'
  const url = getWorkOSClient().userManagement.getAuthorizationUrl({
    provider: 'GoogleOAuth',
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: new URL('/api/auth/google/callback', req.url).toString(),
    state: link ? 'link' : undefined,
  })
  redirect(url)
}
