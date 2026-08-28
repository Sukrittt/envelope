import { json, getCollection, nowIST } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { cachedRead } from '@/lib/cache'
import { currentEdition, monthRange } from '@/lib/wrapped'
import { computeWrapped } from '@/src/services/wrappedAdapter'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const month = new URL(req.url).searchParams.get('month') ?? currentEdition(nowIST().date)
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
