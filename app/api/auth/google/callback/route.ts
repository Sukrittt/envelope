import { NextResponse } from 'next/server'
import { saveSession } from '@workos-inc/authkit-nextjs'
import { getWorkOSClient } from '@/lib/workosClient'

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/', req.url))

  const { user, accessToken, refreshToken } = await getWorkOSClient().userManagement.authenticateWithCode({
    clientId: process.env.WORKOS_CLIENT_ID!,
    code,
  })

  await saveSession({ accessToken, refreshToken, user }, req.url)
  return NextResponse.redirect(new URL('/', req.url))
}
