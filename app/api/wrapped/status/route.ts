import { json, nowIST } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { currentEdition, editionStatus } from '@/lib/wrapped'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const month = currentEdition(nowIST().date)
  const status = await editionStatus(auth, month)
  return json(status)
}
