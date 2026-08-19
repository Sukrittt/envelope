import { NextResponse } from 'next/server'
import { saveSession } from '@workos-inc/authkit-nextjs'
import { getWorkOSClient } from '@/lib/workosClient'
import { ensureUser } from '@/lib/users'

/**
 * Shared by both clients: web relies on the cookie saveSession() sets;
 * mobile has no cookie jar, so the tokens ride along in the JSON body too.
 */
export async function POST(req: Request) {
  const { email, code } = await req.json()
  if (!email || !code) return NextResponse.json({ error: 'email and code required' }, { status: 400 })

  try {
    const { user, accessToken, refreshToken } = await getWorkOSClient().userManagement.authenticateWithMagicAuth({
      clientId: process.env.WORKOS_CLIENT_ID!,
      email,
      code,
    })
    await ensureUser(user)
    await saveSession({ accessToken, refreshToken, user }, req.url)
    return NextResponse.json({ ok: true, accessToken, refreshToken })
  } catch {
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 401 })
  }
}
