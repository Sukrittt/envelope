import { json, error, readBody, getCollection, nowIST } from '@/lib/http'
import { getScope, guestWriteGuard, type Scope } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { cachedRead, invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const scope = getScope(req)
  const coll = await getCollection('expenses', scope)
  const docs = await cachedRead('expenses', scope, () => coll.find({}).toArray())
  return json({ headers: EXPENSE_HEADERS, rows: docs.map((d) => toRow(EXPENSE_HEADERS, d)) })
}

export async function POST(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.item || !body.amount_inr || !body.category) {
    return error('item, amount_inr, category required')
  }

  const ist = nowIST()
  const date = String(body.date || ist.date)
  const timestamp = String(body.timestamp || `${date}T${ist.timestamp.slice(11)}`)
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
      invalidate('budgets', scope)
    }
  }

  invalidate('expenses', scope)
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.timestamp) return error('timestamp required')

  // Locate the row with the same (timestamp, item, amount) triple, so an edit
  // updates the exact expense (same signal the PUT and DELETE use).
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

  // Rebalance the Credit Card envelope when a CC expense's amount or month
  // changes (POST bumps it on add; DELETE unwinds it on remove).
  const isCC = String(found.payment_method ?? '') === 'credit_card'
  const oldMonth = String(found.date ?? '').slice(0, 7)
  const newMonth = String(body.new_date ?? found.date ?? '').slice(0, 7)
  const oldAmount = Number(found.amount_inr) || 0
  const newAmount = body.new_amount_inr !== undefined ? Number(body.new_amount_inr) : oldAmount
  if (isCC && oldAmount !== newAmount) {
    if (oldMonth === newMonth) {
      await adjustCreditCardEnvelope(scope, oldMonth, newAmount - oldAmount)
    } else {
      await adjustCreditCardEnvelope(scope, oldMonth, -oldAmount)
      await adjustCreditCardEnvelope(scope, newMonth, newAmount)
    }
  }

  await coll.updateOne({ _id: found._id }, { $set: update })
  invalidate('expenses', scope)
  return json({ ok: true })
}

/** Nudge the __credit_card__ envelope for a month by an amount delta, floor 0. */
async function adjustCreditCardEnvelope(scope: Scope, month: string, delta: number) {
  if (!month || delta === 0) return
  const budgetColl = await getCollection('budgets', scope)
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
  invalidate('budgets', scope)
}

export async function DELETE(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.timestamp || !body.item || body.amount_inr === undefined) {
    return error('timestamp, item, amount_inr required')
  }

  // Locate the row with the same (timestamp, item, amount) triple the PUT uses,
  // so a delete removes the exact expense rather than a lookalike.
  const coll = await getCollection('expenses', scope)
  const candidates = await coll
    .find({ timestamp: String(body.timestamp), item: String(body.item) })
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

  const paymentMethod = String(found.payment_method ?? '')
  await coll.deleteOne({ _id: found._id })

  // Reverse the Credit Card envelope bump that POST applied for CC purchases.
  if (paymentMethod === 'credit_card') {
    const amountNum = Number(found.amount_inr)
    const month = String(found.date ?? '').slice(0, 7)
    if (!Number.isNaN(amountNum) && amountNum > 0 && month) {
      const budgetColl = await getCollection('budgets', scope)
      const existing = await budgetColl.findOne({ month, category: '__credit_card__' })
      if (existing) {
        const current = Number(existing.assigned) || 0
        await budgetColl.updateOne(
          { _id: existing._id },
          { $set: { assigned: String(Math.max(0, current - amountNum)) } },
        )
      }
      invalidate('budgets', scope)
    }
  }

  invalidate('expenses', scope)
  return json({ ok: true })
}
