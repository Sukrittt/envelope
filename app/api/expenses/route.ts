import { ObjectId } from 'mongodb'
import { json, error, readBody, getCollection, parsePageParams, pageMeta } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import { invalidate } from '@/lib/cache'
import { invalidateCategoryMap } from '@/lib/categoryMap'
import { notifyThresholdCrossed } from '@/lib/notifications/instant'
import { withTx } from '@/lib/mongodb'
import { createExpense, adjustCreditCardEnvelope } from '@/lib/createExpense'
import { resolveCategoryName } from '@/lib/categoryName'

export const dynamic = 'force-dynamic'

const SORT = { date: -1, timestamp: -1, _id: -1 } as const

/**
 * `GET /api/expenses` — two modes, picked by whether `?page=` is present.
 *
 * No `page`: legacy behavior, unchanged. Every other caller of
 * useExpenses()/getExpenses() (budget math, insights, category autosuggest,
 * widgets, ~18 call sites total) needs the full set for correct aggregates,
 * so this path must stay byte-for-byte identical.
 *
 * `page` present: real pagination for the Activity screens. `category` and
 * `from`/`to` (on `date`) filter in Mongo — both are plaintext fields
 * (lib/encryptedFields.ts) and `date` is indexed ({user_id,date} in
 * scripts/ensure-indexes.mjs), so skip/limit works directly. `item`/`notes`
 * are encrypted, so a `q` search can't run as a Mongo $regex — it filters in
 * JS over the already category/date-bounded, decrypted set instead (same
 * ciphertext constraint app/api/ai/chat/sessions/route.ts works around for
 * its own encrypted `title` field).
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const coll = await getCollection('expenses', auth)
  const url = new URL(req.url)

  if (!url.searchParams.has('page')) {
    const docs = await coll.find({}).toArray()
    // `id` and `version` ride alongside the CSV-shaped row rather than joining
    // EXPENSE_HEADERS itself, since that array is also the CSV export's column
    // set — this keeps the export unchanged while giving JSON callers a real
    // row identity and revision for conditional edits/deletes.
    return json({
      headers: EXPENSE_HEADERS,
      rows: docs.map((d) => (expenseRow(d))),
    })
  }

  const { page, limit } = parsePageParams(url, { defaultLimit: 50, maxLimit: 200 })
  const category = url.searchParams.get('category') || undefined
  const from = url.searchParams.get('from') || undefined
  const to = url.searchParams.get('to') || undefined
  const q = url.searchParams.get('q')?.trim().toLowerCase() || undefined

  const mongoFilter: Record<string, unknown> = {}
  if (category) mongoFilter.category = category
  if (from || to) mongoFilter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }

  let pageDocs: Record<string, unknown>[]
  let total: number
  // `amount_inr` is encrypted too, so the period-total footer both clients
  // show (sum over the whole filtered set, not just this page) needs
  // decrypted rows — bounded by the same category/date filter either way.
  let totalAmount: number

  if (q) {
    const matched = (await coll.find(mongoFilter).sort(SORT).toArray()).filter((d) => {
      const item = String(d.item ?? '').toLowerCase()
      const notes = String(d.notes ?? '').toLowerCase()
      return item.includes(q) || notes.includes(q)
    })
    total = matched.length
    totalAmount = matched.reduce((s, d) => s + (Number(d.amount_inr) || 0), 0)
    const start = (page - 1) * limit
    pageDocs = matched.slice(start, start + limit)
  } else {
    // `total` used to come from a separate countDocuments() call; the
    // amount_inr-only fetch below already visits every matching doc, so its
    // length is the same count for free. Running it alongside the page fetch
    // (instead of after, sequentially) turns 3 round trips into 2 concurrent ones.
    const [pageResult, forTotal] = await Promise.all([
      coll
        .find(mongoFilter)
        .sort(SORT)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      coll.find(mongoFilter, { projection: { amount_inr: 1 } }).toArray(),
    ])
    pageDocs = pageResult
    total = forTotal.length
    totalAmount = forTotal.reduce((s, d) => s + (Number(d.amount_inr) || 0), 0)
  }

  return json({
    headers: EXPENSE_HEADERS,
    rows: pageDocs.map((d) => (expenseRow(d))),
    total,
    totalAmount,
    ...pageMeta(total, page, limit),
  })
}

// Existing records without a version start at 0; no backfill is required.
function expenseRow(doc: Record<string, unknown>) {
  return { ...toRow(EXPENSE_HEADERS, doc), id: String(doc._id), version: Number(doc.version ?? 0) }
}

class ExpenseWriteError extends Error {
  constructor(readonly status: number, message: string, readonly current?: Record<string, unknown>) {
    super(message)
  }
}

function writePrecondition(body: Record<string, unknown>) {
  if (body.version === undefined) return error('Refresh or update the app before editing or deleting transactions.', 428)
  if (typeof body.version !== 'number' || !Number.isSafeInteger(body.version) || body.version < 0) {
    return error('a non-negative integer version is required')
  }
  if (typeof body.id !== 'string' || !ObjectId.isValid(body.id)) return error('a valid expense id is required', 400)
  return null
}

function checkExpense(found: Record<string, unknown> | null, version: unknown): asserts found is Record<string, unknown> {
  if (!found) throw new ExpenseWriteError(404, 'This transaction was deleted on another device. Your changes have not been saved.')
  if (Number(found.version ?? 0) !== version) {
    throw new ExpenseWriteError(409, 'This transaction changed on another device. Review the latest version before saving or deleting.', expenseRow(found))
  }
}

function writeError(err: unknown) {
  if (!(err instanceof ExpenseWriteError)) throw err
  return json({ error: err.message, ...(err.current ? { current: err.current } : {}) }, { status: err.status })
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.item || !body.amount_inr || !body.category) {
    return error('item, amount_inr, category required')
  }

  // The insert itself lives in `lib/createExpense.ts` so the recurring-expense
  // cron can reuse it verbatim instead of forking a simplified copy.
  const result = await createExpense(auth, {
    item: String(body.item),
    amount_inr: String(body.amount_inr),
    category: String(body.category),
    notes: body.notes === undefined ? undefined : String(body.notes),
    date: body.date === undefined ? undefined : String(body.date),
    timestamp: body.timestamp === undefined ? undefined : String(body.timestamp),
    payment_method: body.payment_method === undefined ? undefined : String(body.payment_method),
    client_id: typeof body.client_id === 'string' ? body.client_id : undefined,
  })

  // The id and the server-generated timestamp go back to the caller so it can
  // address the row it just created — mobile's post-log success screen needs
  // both to offer Undo without re-fetching the whole list to find the row.
  // `category` is echoed back because it may not be the one that was asked for:
  // a client posting from a list loaded before a rename gets mapped forward, and
  // its success screen looks up the envelope by name.
  return json(
    result.duplicate
      ? { ok: true, id: result.id, version: result.version, timestamp: result.timestamp, category: result.category, duplicate: true }
      : { ok: true, id: result.id, version: result.version, timestamp: result.timestamp, category: result.category },
  )
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  const precondition = writePrecondition(body)
  if (precondition) return precondition
  const coll = await getCollection('expenses', auth)

  const update: Record<string, string> = {}
  if (body.category !== undefined) update.category = String(body.category)
  if (body.new_item !== undefined) update.item = String(body.new_item)
  if (body.new_amount_inr !== undefined) update.amount_inr = String(body.new_amount_inr)
  if (body.new_date !== undefined) update.date = String(body.new_date)
  if (body.new_notes !== undefined) update.notes = String(body.new_notes)
  if (body.new_payment_method !== undefined) update.payment_method = String(body.new_payment_method)
  if (Object.keys(update).length === 0) return error('no fields to update')

  let outcome: { category: string; affectsCC: boolean; version: number }
  try {
    outcome = await withTx(async (session) => {
      // Every retry must read again inside its snapshot. Never capture old
      // amounts, dates, or payment methods outside this callback.
      const found = await coll.findOne({ _id: new ObjectId(String(body.id)) }, { session })
      checkExpense(found, body.version)
      const version = Number(found.version ?? 0)
      // Recategorizing from a list loaded before a rename must not park the
      // row under a name no category has any more (lib/categoryName.ts).
      // Idempotent on retry: a live name resolves to itself.
      if (update.category !== undefined) update.category = await resolveCategoryName(auth, update.category, session)
      const next: Record<string, unknown> = { ...update, version: version + 1 }
      if (body.new_date !== undefined && found.timestamp !== undefined) {
        const ts = String(found.timestamp)
        next.timestamp = `${String(body.new_date)}${ts.includes('T') ? ts.slice(ts.indexOf('T')) : ''}`
      }
      const oldIsCC = found.payment_method === 'credit_card'
      const newIsCC = (update.payment_method ?? found.payment_method) === 'credit_card'
      const oldMonth = String(found.date ?? '').slice(0, 7)
      const newMonth = String(update.date ?? found.date ?? '').slice(0, 7)
      const oldAmount = Number(found.amount_inr) || 0
      const newAmount = Number(update.amount_inr ?? found.amount_inr) || 0
      const result = await coll.updateOne(
        { _id: found._id, version: found.version ?? { $exists: false } },
        { $set: next }, { session },
      )
      // Throw *inside* the transaction so no side effect can commit on a miss.
      if (result.matchedCount !== 1) throw new ExpenseWriteError(409, 'This transaction changed. Refresh and review it before saving.')
      if (oldIsCC && newIsCC && oldMonth === newMonth) {
        await adjustCreditCardEnvelope(auth, oldMonth, newAmount - oldAmount, session)
      } else {
        if (oldIsCC) await adjustCreditCardEnvelope(auth, oldMonth, -oldAmount, session)
        if (newIsCC) await adjustCreditCardEnvelope(auth, newMonth, newAmount, session)
      }
      return { category: update.category ?? String(found.category ?? ''), affectsCC: oldIsCC || newIsCC, version: version + 1 }
    })
  } catch (err) {
    return writeError(err)
  }

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  if (outcome.affectsCC) invalidate('budgets', auth.userId)
  invalidateCategoryMap(auth.userId)
  // The category that could newly be over its threshold: wherever the edit
  // landed the expense, not where it used to be.
  await notifyThresholdCrossed(auth, outcome.category)
  return json({ ok: true, version: outcome.version })
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  const precondition = writePrecondition(body)
  if (precondition) return precondition
  const coll = await getCollection('expenses', auth)
  let outcome: { category: string; affectsCC: boolean }
  try {
    outcome = await withTx(async (session) => {
      const found = await coll.findOne({ _id: new ObjectId(String(body.id)) }, { session })
      checkExpense(found, body.version)
      const result = await coll.deleteOne(
        { _id: found._id, version: found.version ?? { $exists: false } }, { session },
      )
      if (result.deletedCount !== 1) throw new ExpenseWriteError(409, 'This transaction changed. Refresh and review it before deleting.')
      const affectsCC = found.payment_method === 'credit_card'
      const amount = Number(found.amount_inr)
      if (affectsCC && amount > 0) {
        await adjustCreditCardEnvelope(auth, String(found.date ?? '').slice(0, 7), -amount, session)
      }
      return { category: String(found.category ?? ''), affectsCC }
    })
  } catch (err) {
    return writeError(err)
  }

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  if (outcome.affectsCC) invalidate('budgets', auth.userId)
  invalidateCategoryMap(auth.userId)

  // Deleting can drop a category back below a threshold it had crossed —
  // sync that the same way an edit-down does, so a later re-cross fires again.
  await notifyThresholdCrossed(auth, outcome.category)

  return json({ ok: true })
}
