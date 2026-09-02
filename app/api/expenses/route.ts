import { ObjectId, type ClientSession } from 'mongodb'
import { json, error, readBody, getCollection, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard, type Auth } from '@/lib/access'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { invalidate } from '@/lib/cache'
import { invalidateCategoryMap } from '@/lib/categoryMap'
import type { ScopedCollection } from '@/lib/scoped'
import { notifyThresholdCrossed } from '@/lib/notifications/instant'
import { withTx } from '@/lib/mongodb'
import { casRetry } from '@/lib/cas'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('expenses', auth)
  const docs = await coll.find({}).toArray()
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

  // The expense insert and its Credit Card envelope bump must land together —
  // a partial write here leaves an expense with no matching envelope bump.
  const insertedId = await withTx(async (session) => {
    const inserted = await coll.insertOne(
      {
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
      },
      { session },
    )

    // Auto-transfer to the Credit Card envelope for CC purchases.
    if (paymentMethod === 'credit_card') {
      const amountNum = Number(body.amount_inr)
      if (!Number.isNaN(amountNum) && amountNum > 0) {
        await adjustCreditCardEnvelope(auth, date.slice(0, 7), amountNum, session)
      }
    }

    return inserted.insertedId
  })

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  if (paymentMethod === 'credit_card') invalidate('budgets', auth.userId)
  invalidateCategoryMap(auth.userId)
  // Awaited (not fire-and-forget): a serverless function can be frozen the
  // instant the response is sent, so a background call here could just never
  // run. notifyThresholdCrossed never throws, so this only adds latency, not
  // failure risk.
  await notifyThresholdCrossed(auth, String(body.category))
  // The id and the server-generated timestamp go back to the caller so it can
  // address the row it just created — mobile's post-log success screen needs
  // both to offer Undo without re-fetching the whole list to find the row.
  return json({ ok: true, id: String(insertedId), timestamp })
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
  if (body.new_notes !== undefined) update.notes = String(body.new_notes)
  if (body.new_payment_method !== undefined) update.payment_method = String(body.new_payment_method)
  if (Object.keys(update).length === 0) return error('no fields to update')

  // Keep the timestamp (date + time) in sync when only the date changes.
  if (body.new_date !== undefined && found.timestamp !== undefined) {
    const ts = String(found.timestamp)
    const suffix = ts.includes('T') ? ts.slice(ts.indexOf('T')) : ''
    update.timestamp = `${String(body.new_date)}${suffix}`
  }

  // Rebalance the Credit Card envelope when a CC expense's amount, month,
  // and/or payment method changes (POST bumps it on add; DELETE unwinds it
  // on remove). Unwind whatever the old state contributed, then reapply
  // whatever the new state should contribute — handles amount-only changes,
  // month moves, and bank<->credit_card switches uniformly.
  const oldIsCC = String(found.payment_method ?? '') === 'credit_card'
  const newIsCC = String(body.new_payment_method ?? found.payment_method ?? '') === 'credit_card'
  const oldMonth = String(found.date ?? '').slice(0, 7)
  const newMonth = String(body.new_date ?? found.date ?? '').slice(0, 7)
  const oldAmount = Number(found.amount_inr) || 0
  const newAmount = body.new_amount_inr !== undefined ? Number(body.new_amount_inr) : oldAmount

  // The row edit and its envelope rebalance must land together — same
  // reasoning as POST.
  const matchedCount = await withTx(async (session) => {
    if (oldIsCC && newIsCC && oldMonth === newMonth) {
      if (oldAmount !== newAmount) await adjustCreditCardEnvelope(auth, oldMonth, newAmount - oldAmount, session)
    } else {
      if (oldIsCC) await adjustCreditCardEnvelope(auth, oldMonth, -oldAmount, session)
      if (newIsCC) await adjustCreditCardEnvelope(auth, newMonth, newAmount, session)
    }

    return (await coll.updateOne({ _id: found._id }, { $set: update }, { session })).matchedCount
  })

  // updateOne on a wrong/stale _id silently no-ops (matchedCount 0) rather than
  // throwing — without this check the API still answers 200 and the client
  // invalidates + refetches into what looks like "the edit didn't take".
  if (matchedCount === 0) return error('expense row not found', 404)

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  if (oldIsCC || newIsCC) invalidate('budgets', auth.userId)
  invalidateCategoryMap(auth.userId)
  // The category that could newly be over its threshold: wherever the edit
  // landed the expense, not where it used to be.
  await notifyThresholdCrossed(auth, update.category ?? String(found.category ?? ''))
  return json({ ok: true })
}

/**
 * Nudge the __credit_card__ envelope for a month by an amount delta, floor 0.
 * Always called from inside a caller's `withTx` — takes that transaction's
 * session rather than starting its own. Guards its update on the `assigned`
 * value it just read (money fields are strings, so `$inc` isn't available)
 * and retries on a lost race; a concurrent insert for the same month is
 * caught via the unique partial index and retried as an update.
 */
async function adjustCreditCardEnvelope(auth: Auth, month: string, delta: number, session: ClientSession) {
  if (!month || delta === 0) return
  const budgetColl = await getCollection('budgets', auth)

  await casRetry<'done'>(async () => {
    const existing = await budgetColl.findOne({ month, category: '__credit_card__' }, { session })
    if (existing) {
      const current = Number(existing.assigned) || 0
      const result = await budgetColl.updateOne(
        { _id: existing._id, assigned: existing.assigned },
        { $set: { assigned: String(Math.max(0, current + delta)) } },
        { session },
      )
      return result.matchedCount === 0 ? 'retry' : 'done'
    }
    if (delta <= 0) return 'done'
    try {
      await budgetColl.insertOne(
        { month, category: '__credit_card__', assigned: String(delta), rolled_over: '0' },
        { session },
      )
      return 'done'
    } catch (err) {
      if (isDuplicateKeyError(err)) return 'retry'
      throw err
    }
  })
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000
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

  // The delete and its envelope unwind must land together — same reasoning as POST/PUT.
  await withTx(async (session) => {
    await coll.deleteOne({ _id: found._id }, { session })

    // Reverse the Credit Card envelope bump that POST applied for CC purchases.
    if (paymentMethod === 'credit_card') {
      const amountNum = Number(found.amount_inr)
      const month = String(found.date ?? '').slice(0, 7)
      if (!Number.isNaN(amountNum) && amountNum > 0 && month) {
        await adjustCreditCardEnvelope(auth, month, -amountNum, session)
      }
    }
  })

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  if (paymentMethod === 'credit_card') invalidate('budgets', auth.userId)
  invalidateCategoryMap(auth.userId)

  // Deleting can drop a category back below a threshold it had crossed —
  // sync that the same way an edit-down does, so a later re-cross fires again.
  await notifyThresholdCrossed(auth, String(found.category ?? ''))

  return json({ ok: true })
}
