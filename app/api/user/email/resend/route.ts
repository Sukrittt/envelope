import { json } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { getWorkOSClient } from '@/lib/workosClient'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  await getWorkOSClient().userManagement.sendVerificationEmail({ userId: auth.userId })
  return json({ ok: true })
}
