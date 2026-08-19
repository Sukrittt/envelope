import { NextResponse } from 'next/server'
import { getWorkOSClient } from '@/lib/workosClient'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  await getWorkOSClient().userManagement.createMagicAuth({ email })
  return NextResponse.json({ ok: true })
}
