import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const coll = await getCollection('expenses', scope)
  const docs = await coll.find({}).toArray()
  return json({ headers: EXPENSE_HEADERS, rows: docs.map((d) => toRow(EXPENSE_HEADERS, d)) })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.item || !body.amount_inr || !body.category) {
    return error('item, amount_inr, category required')
  }

  const now = new Date()
  const date = String(body.date || now.toISOString().slice(0, 10))
  const timestamp = String(body.timestamp || `${date}T${now.toTimeString().slice(0, 8)}+05:30`)
  const paymentMethod = String(body.payment_method ?? 'bank')

  const coll = await getCollection('expenses', scope)
  await coll.insertOne({
    timestamp,
    date,
    item: String(body.item),
    amount_inr: String(body.amount_inr),
    category: String(body.category),
    notes: String(body.notes ?? ''),
    source: 'manual',
    amount: '',
    description: '',
    payment_method: paymentMethod,
  })

  // Auto-transfer to the Credit Card envelope for CC purchases.
  if (paymentMethod === 'credit_card') {
    const amountNum = Number(body.amount_inr)
    if (!Number.isNaN(amountNum) && amountNum > 0) {
      const month = date.slice(0, 7)
      const budgetColl = await getCollection('budgets', scope)
      const existing = await budgetColl.findOne({ month, category: '__credit_card__' })
      if (existing) {
        const current = Number(existing.assigned) || 0
        await budgetColl.updateOne(
          { month, category: '__credit_card__' },
          { $set: { assigned: String(current + amountNum) } },
        )
      } else {
        await budgetColl.insertOne({
          month,
          category: '__credit_card__',
          assigned: String(amountNum),
          rolled_over: '0',
        })
      }
    }
  }

  return json({ ok: true })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.timestamp || !body.category) return error('timestamp and category required')

  const coll = await getCollection('expenses', scope)
  const candidates = await coll
    .find({ timestamp: String(body.timestamp), item: String(body.item ?? '') })
    .sort({ _id: 1 })
    .toArray()

  let found: (typeof candidates)[number] | null = null
  for (const c of candidates) {
    if (Number(c.amount_inr) === Number(body.amount_inr)) {
      found = c
      break
    }
  }
  if (!found) return error('expense row not found', 404)

  await coll.updateOne({ _id: found._id }, { $set: { category: String(body.category) } })
  return json({ ok: true })
}
