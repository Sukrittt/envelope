import { json, error, getCollection } from '@/lib/http'
import { getAuth } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const expenses = await getCollection('expenses', auth)
  const categories = await getCollection('categories', auth)
  const [transactionCount, envelopeCount] = await Promise.all([
    expenses.countDocuments(),
    categories.countDocuments(),
  ])

  return json({ transactionCount, envelopeCount })
}
