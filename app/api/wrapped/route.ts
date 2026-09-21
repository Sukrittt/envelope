import { json, getCollection } from '@/lib/http'
import { nowForUser } from '@/lib/userCurrency'
import { getAuth } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { cachedRead } from '@/lib/cache'
import { currentEdition, monthRange } from '@/lib/wrapped'
import { computeWrapped } from '@/src/services/wrappedAdapter'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const month = new URL(req.url).searchParams.get('month') ?? currentEdition((await nowForUser(auth.userId)).date)
  const { start, end } = monthRange(month)
  const data = await cachedRead(
    'wrapped',
    auth.userId,
    async () => {
      const coll = await getCollection('expenses', auth)
      const docs = await coll.find({ date: { $gte: start, $lte: end } }).toArray()
      const rows = docs.map((d) => toRow(EXPENSE_HEADERS, d))
      return computeWrapped(rows, month)
    },
    month,
  )
  return json(data)
}
