import { ObjectId } from 'mongodb'
import { json, error, readBody, getCollection, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { RECURRING_EXPENSE_HEADERS, toRow } from '@/lib/models'
import { invalidate } from '@/lib/cache'
import { FREQUENCIES, firstRunOnOrAfter, type Frequency } from '@/lib/recurringExpense'

export const dynamic = 'force-dynamic'

const STATUSES = new Set(['active', 'paused', 'ended'])
const PAYMENT_METHODS = new Set(['bank', 'credit_card'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as string[]).includes(value)
}

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('recurring_expenses', auth)
  const docs = await coll.find({}).toArray()
  // `id` rides alongside the CSV-shaped headers/rows rather than joining
  // RECURRING_EXPENSE_HEADERS, same as app/api/expenses — clients edit and
  // delete by it, since `item` is encrypted and can't be a lookup key.
  return json({
    headers: RECURRING_EXPENSE_HEADERS,
    rows: docs.map((d) => ({ id: String(d._id), ...toRow(RECURRING_EXPENSE_HEADERS, d) })),
  })
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.item || !body.amount_inr || !body.category || !body.frequency || !body.start_date) {
    return error('item, amount_inr, category, frequency, start_date required')
  }

  const frequency = String(body.frequency)
  if (!isFrequency(frequency)) return error(`frequency must be one of ${FREQUENCIES.join(', ')}`)

  const startDate = String(body.start_date)
  if (!DATE_RE.test(startDate)) return error('start_date must be YYYY-MM-DD')

  const endDate = String(body.end_date ?? '')
  if (endDate && !DATE_RE.test(endDate)) return error('end_date must be YYYY-MM-DD')
  if (endDate && endDate < startDate) return error('end_date must not precede start_date')

  const paymentMethod = String(body.payment_method ?? 'bank')
  if (!PAYMENT_METHODS.has(paymentMethod)) return error('payment_method must be bank or credit_card')

  const { date: today, timestamp } = nowIST()

  const coll = await getCollection('recurring_expenses', auth)
  const inserted = await coll.insertOne({
    item: String(body.item),
    amount_inr: String(body.amount_inr),
    category: String(body.category),
    notes: String(body.notes ?? ''),
    payment_method: paymentMethod,
    frequency,
    start_date: startDate,
    end_date: endDate,
    // Computed here, never taken from the client: a backdated start schedules
    // forward instead of instantly backfilling history nobody asked for. The
    // cron's backfill is for runs it *missed*, not for dates that predate the
    // recurrence being created.
    next_run_date: firstRunOnOrAfter(startDate, frequency, today),
    status: 'active',
    created_at: timestamp,
  })

  invalidate('recurring_expenses', auth.userId)
  return json({ ok: true, id: String(inserted.insertedId) })
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id || !ObjectId.isValid(id)) return error('id required')

  const coll = await getCollection('recurring_expenses', auth)
  const existing = await coll.findOne({ _id: new ObjectId(id) })
  if (!existing) return error('recurring expense not found', 404)

  const update: Record<string, string> = {}
  if (body.item !== undefined) update.item = String(body.item)
  if (body.amount_inr !== undefined) update.amount_inr = String(body.amount_inr)
  if (body.category !== undefined) update.category = String(body.category)
  if (body.notes !== undefined) update.notes = String(body.notes)

  if (body.payment_method !== undefined) {
    const paymentMethod = String(body.payment_method)
    if (!PAYMENT_METHODS.has(paymentMethod)) return error('payment_method must be bank or credit_card')
    update.payment_method = paymentMethod
  }

  if (body.status !== undefined) {
    const status = String(body.status)
    if (!STATUSES.has(status)) return error('status must be active, paused or ended')
    update.status = status
  }

  if (body.frequency !== undefined) {
    const frequency = String(body.frequency)
    if (!isFrequency(frequency)) return error(`frequency must be one of ${FREQUENCIES.join(', ')}`)
    update.frequency = frequency
  }

  if (body.start_date !== undefined) {
    const startDate = String(body.start_date)
    if (!DATE_RE.test(startDate)) return error('start_date must be YYYY-MM-DD')
    update.start_date = startDate
  }

  if (body.end_date !== undefined) {
    const endDate = String(body.end_date)
    if (endDate && !DATE_RE.test(endDate)) return error('end_date must be YYYY-MM-DD')
    update.end_date = endDate
  }

  const startDate = update.start_date ?? String(existing.start_date)
  const endDate = update.end_date ?? String(existing.end_date ?? '')
  if (endDate && endDate < startDate) return error('end_date must not precede start_date')

  // Rescheduling changes where the next occurrence lands, so recompute rather
  // than leaving a `next_run_date` that belongs to the old schedule.
  if (update.frequency !== undefined || update.start_date !== undefined) {
    const frequency = update.frequency ?? String(existing.frequency)
    update.next_run_date = firstRunOnOrAfter(startDate, frequency, nowIST().date)
  }

  await coll.updateOne({ _id: existing._id }, { $set: update })
  invalidate('recurring_expenses', auth.userId)
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id || !ObjectId.isValid(id)) return error('id required')

  const coll = await getCollection('recurring_expenses', auth)
  const result = await coll.deleteOne({ _id: new ObjectId(id) })
  if (result.deletedCount === 0) return error('recurring expense not found', 404)

  invalidate('recurring_expenses', auth.userId)
  return json({ ok: true })
}
