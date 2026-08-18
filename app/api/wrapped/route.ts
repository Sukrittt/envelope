import { json, getCollection } from '@/lib/http'
import { getScope } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { cachedRead } from '@/lib/cache'
import { computeWrapped } from '@/src/services/wrappedAdapter'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const scope = getScope(req)
  const data = await cachedRead('wrapped', scope, async () => {
    const coll = await getCollection('expenses', scope)
    const docs = await coll.find({}).toArray()
    const rows = docs.map((d) => toRow(EXPENSE_HEADERS, d))
    return computeWrapped(rows)
  })
  return json(data)
}
