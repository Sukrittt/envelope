import { redirect } from 'next/navigation'
import { getWorkOSClient } from '@/lib/workosClient'

/** Skips the AuthKit picker entirely — straight to Google's consent screen. */
export async function GET(req: Request) {
  const url = getWorkOSClient().userManagement.getAuthorizationUrl({
    provider: 'GoogleOAuth',
    clientId: process.env.WORKOS_CLIENT_ID!,
    redirectUri: new URL('/api/auth/google/callback', req.url).toString(),
  })
  redirect(url)
}
