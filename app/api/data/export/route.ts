import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { scoped } from '@/lib/scoped'
import { toCsv } from '@/lib/csv'
import {
  COLLECTIONS,
  toRow,
  EXPENSE_HEADERS,
  BUDGET_HEADERS,
  CATEGORY_HEADERS,
  GROUP_HEADERS,
  SUBSCRIPTION_HEADERS,
  HOLDING_HEADERS,
  HOLDING_EVENT_HEADERS,
} from '@/lib/models'

export const dynamic = 'force-dynamic'

const HEADERS: Partial<Record<keyof typeof COLLECTIONS, string[]>> = {
  expenses: EXPENSE_HEADERS,
  budgets: BUDGET_HEADERS,
  categories: CATEGORY_HEADERS,
  groups: GROUP_HEADERS,
  subscriptions: SUBSCRIPTION_HEADERS,
  holdings: HOLDING_HEADERS,
  holdingEvents: HOLDING_EVENT_HEADERS,
}

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const url = new URL(req.url)
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'json'

  const db = await getDb()
  const out: Record<string, unknown> = {}

  for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
    if (key === 'pushTokens' || key === 'notificationLog') continue // device/notification plumbing, not user data

    const docs = await scoped(db.collection(name), auth.userId).find({}).toArray()
    const cleaned = docs.map(({ _id: _drop1, user_id: _drop2, ...rest }) => rest)
    const headers = HEADERS[key]

    if (!headers) {
      out[key] = cleaned
      continue
    }
    const rows = cleaned.map((d) => toRow(headers, d))
    out[key] = format === 'csv' ? toCsv(headers, rows) : rows
  }

  return json(out)
}
