import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getWorkOSClient } from '@/lib/workosClient'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const identities = await getWorkOSClient().userManagement.getUserIdentities(auth.userId)
  return json({ providers: identities.map((i) => i.provider) })
}
