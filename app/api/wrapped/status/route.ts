import { json, nowIST } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { currentEdition, editionStatus } from '@/lib/wrapped'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const today = nowIST().date
  const [status, inProgress] = await Promise.all([
    editionStatus(auth, currentEdition(today)),
    editionStatus(auth, today.slice(0, 7)),
  ])
  return json({
    ...status,
    currentMonth: inProgress.month,
    currentMonthCount: inProgress.transactionCount,
  })
}
