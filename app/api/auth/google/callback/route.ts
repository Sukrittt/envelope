import { NextResponse } from 'next/server'
import { saveSession } from '@workos-inc/authkit-nextjs'
import { getWorkOSClient } from '@/lib/workosClient'
import { ensureUser } from '@/lib/users'
import { getAuth } from '@/lib/access'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/', req.url))

  const isLink = url.searchParams.get('state') === 'link'
  // Read the caller's existing session before authenticating, so a link
  // attempt can be compared against it rather than blindly overwriting it.
  const before = isLink ? await getAuth(req) : null

  const { user, accessToken, refreshToken } = await getWorkOSClient().userManagement.authenticateWithCode({
    clientId: process.env.WORKOS_CLIENT_ID!,
    code,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  if (isLink && before && !before.readOnly && user.id !== before.userId) {
    // A different Google account than the one signed in — WorkOS just created
    // (or authenticated as) a distinct user. Leave the current session alone.
    return NextResponse.redirect(new URL('/account/security?linkError=1', req.url))
  }

  await ensureUser(user)
  await saveSession({ accessToken, refreshToken, user }, req.url)
  return NextResponse.redirect(new URL(isLink ? '/account/security?linked=1' : '/', req.url))
}
