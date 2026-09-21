import { json } from '@/lib/http'
import { nowForUser } from '@/lib/userCurrency'
import { getAuth } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { currentEdition, editionStatus } from '@/lib/wrapped'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const today = (await nowForUser(auth.userId)).date
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
