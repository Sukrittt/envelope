import { ObjectId } from 'mongodb'
import { json, error, readBody, getCollection, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard, type Auth } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { cachedRead, invalidate } from '@/lib/cache'
import type { ScopedCollection } from '@/lib/scoped'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('expenses', auth)
  const docs = await cachedRead('expenses', auth.userId, () => coll.find({}).toArray())
  // `id` rides alongside the CSV-shaped headers/row rather than joining
  // EXPENSE_HEADERS itself, since that array is also the CSV export's column
  // set — this keeps the export unchanged while giving JSON callers a real
  // row identity to edit/delete by by (see findExpense below).
  return json({
    headers: EXPENSE_HEADERS,
    rows: docs.map((d) => ({ id: String(d._id), ...toRow(EXPENSE_HEADERS, d) })),
  })
}

type ExpenseDoc = Record<string, unknown> & { _id: ObjectId }

/**
 * Locate one expense row. Prefers `id` (a real Mongo _id, added to the GET
 * response above) when the caller supplies one; falls back to the legacy
 * (timestamp, item, amount) triple-match — first candidate whose amount
 * matches wins — for one release, so a stale mobile build (which only knows
 * the triple) keeps working. Drop the fallback once every client sends `id`.
 */
async function findExpense(
  coll: ScopedCollection,
  body: Record<string, unknown>,
): Promise<ExpenseDoc | null> {
  const id = typeof body.id === 'string' ? body.id : null
  if (id) {
    if (!ObjectId.isValid(id)) return null
    return (await coll.findOne({ _id: new ObjectId(id) })) as ExpenseDoc | null
  }

  const candidates = (await coll
    .find({ timestamp: String(body.timestamp ?? ''), item: String(body.item ?? '') })
    .sort({ _id: 1 })
    .toArray()) as ExpenseDoc[]

  for (const c of candidates) {
    if (Number(c.amount_inr) === Number(body.amount_inr)) return c
  }
  return null
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.item || !body.amount_inr || !body.category) {
    return error('item, amount_inr, category required')
  }

  const ist = nowIST()
  const date = String(body.date || ist.date)
  const timestamp = String(body.timestamp || `${date}T${ist.timestamp.slice(11)}`)
  const paymentMethod = String(body.payment_method ?? 'bank')

  const coll = await getCollection('expenses', auth)
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
      await adjustCreditCardEnvelope(auth, date.slice(0, 7), amountNum)
    }
  }

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.id && !body.timestamp) return error('id or timestamp required')

  const coll = await getCollection('expenses', auth)
  const found = await findExpense(coll, body)
  if (!found) return error('expense row not found', 404)

  const update: Record<string, string> = {}
  if (body.category !== undefined) update.category = String(body.category)
  if (body.new_item !== undefined) update.item = String(body.new_item)
  if (body.new_amount_inr !== undefined) update.amount_inr = String(body.new_amount_inr)
  if (body.new_date !== undefined) update.date = String(body.new_date)
  if (Object.keys(update).length === 0) return error('no fields to update')

  // Keep the timestamp (date + time) in sync when only the date changes.
  if (body.new_date !== undefined && found.timestamp !== undefined) {
    const ts = String(found.timestamp)
    const suffix = ts.includes('T') ? ts.slice(ts.indexOf('T')) : ''
    update.timestamp = `${String(body.new_date)}${suffix}`
  }

  // Rebalance the Credit Card envelope when a CC expense's amount and/or
  // month changes (POST bumps it on add; DELETE unwinds it on remove). Must
  // trigger on EITHER changing, not just amount — moving a CC expense to a
  // different month at the same amount used to leave the old month's
  // envelope stale and never touch the new month's at all.
  const isCC = String(found.payment_method ?? '') === 'credit_card'
  const oldMonth = String(found.date ?? '').slice(0, 7)
  const newMonth = String(body.new_date ?? found.date ?? '').slice(0, 7)
  const oldAmount = Number(found.amount_inr) || 0
  const newAmount = body.new_amount_inr !== undefined ? Number(body.new_amount_inr) : oldAmount
  if (isCC && (oldAmount !== newAmount || oldMonth !== newMonth)) {
    if (oldMonth === newMonth) {
      await adjustCreditCardEnvelope(auth, oldMonth, newAmount - oldAmount)
    } else {
      await adjustCreditCardEnvelope(auth, oldMonth, -oldAmount)
      await adjustCreditCardEnvelope(auth, newMonth, newAmount)
    }
  }

  await coll.updateOne({ _id: found._id }, { $set: update })
  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  return json({ ok: true })
}

/** Nudge the __credit_card__ envelope for a month by an amount delta, floor 0. */
async function adjustCreditCardEnvelope(auth: Auth, month: string, delta: number) {
  if (!month || delta === 0) return
  const budgetColl = await getCollection('budgets', auth)
  const existing = await budgetColl.findOne({ month, category: '__credit_card__' })
  if (existing) {
    const current = Number(existing.assigned) || 0
    await budgetColl.updateOne(
      { _id: existing._id },
      { $set: { assigned: String(Math.max(0, current + delta)) } },
    )
  } else if (delta > 0) {
    await budgetColl.insertOne({
      month,
      category: '__credit_card__',
      assigned: String(delta),
      rolled_over: '0',
    })
  }
  invalidate('budgets', auth.userId)
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.id && (!body.timestamp || !body.item || body.amount_inr === undefined)) {
    return error('id, or timestamp/item/amount_inr, required')
  }

  const coll = await getCollection('expenses', auth)
  const found = await findExpense(coll, body)
  if (!found) return error('expense row not found', 404)

  const paymentMethod = String(found.payment_method ?? '')
  await coll.deleteOne({ _id: found._id })

  // Reverse the Credit Card envelope bump that POST applied for CC purchases.
  if (paymentMethod === 'credit_card') {
    const amountNum = Number(found.amount_inr)
    const month = String(found.date ?? '').slice(0, 7)
    if (!Number.isNaN(amountNum) && amountNum > 0 && month) {
      await adjustCreditCardEnvelope(auth, month, -amountNum)
    }
  }

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  return json({ ok: true })
}
