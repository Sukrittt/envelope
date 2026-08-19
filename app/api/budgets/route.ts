import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { BUDGET_HEADERS, toRow } from '@/lib/models'
import { cachedRead, invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('budgets', auth)
  const docs = await cachedRead('budgets', auth.userId, () => coll.find({}).toArray())
  return json({ headers: BUDGET_HEADERS, rows: docs.map((d) => toRow(BUDGET_HEADERS, d)) })
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category || body.assigned === undefined) {
    return error('month, category, assigned required')
  }

  const coll = await getCollection('budgets', auth)
  await coll.insertOne({
    month: String(body.month),
    category: String(body.category),
    assigned: String(body.assigned),
    rolled_over: String(body.rolled_over ?? 0),
  })
  invalidate('budgets', auth.userId)
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category) return error('month, category required')

  const update: Record<string, string> = {}
  if (body.assigned !== undefined) update.assigned = String(body.assigned)
  if (body.rolled_over !== undefined) update.rolled_over = String(body.rolled_over)
  if (body.newCategory !== undefined) update.category = String(body.newCategory)

  const coll = await getCollection('budgets', auth)
  // Upsert: an envelope's category may have no budget row yet (e.g. a
  // subscription category whose assigned comes from rollover/spend only).
  // updateBudget (PUT) must create the row then, not 404 — otherwise the
  // client's optimistic local edit never reaches the DB and reverts on reload.
  await coll.updateOne(
    { month: String(body.month), category: String(body.category) },
    { $set: update },
    { upsert: true },
  )
  invalidate('budgets', auth.userId)
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category) return error('month, category required')

  const coll = await getCollection('budgets', auth)
  const result = await coll.deleteOne({ month: String(body.month), category: String(body.category) })
  if (result.deletedCount === 0) return error('budget row not found', 404)
  invalidate('budgets', auth.userId)
  return json({ ok: true })
}
