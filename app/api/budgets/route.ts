import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'
import { BUDGET_HEADERS, toRow } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const coll = await getCollection('budgets', scope)
  const docs = await coll.find({}).toArray()
  return json({ headers: BUDGET_HEADERS, rows: docs.map((d) => toRow(BUDGET_HEADERS, d)) })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category || body.assigned === undefined) {
    return error('month, category, assigned required')
  }

  const coll = await getCollection('budgets', scope)
  await coll.insertOne({
    month: String(body.month),
    category: String(body.category),
    assigned: String(body.assigned),
    rolled_over: String(body.rolled_over ?? 0),
  })
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category) return error('month, category required')

  const update: Record<string, string> = {}
  if (body.assigned !== undefined) update.assigned = String(body.assigned)
  if (body.rolled_over !== undefined) update.rolled_over = String(body.rolled_over)
  if (body.newCategory !== undefined) update.category = String(body.newCategory)

  const coll = await getCollection('budgets', scope)
  const result = await coll.updateOne(
    { month: String(body.month), category: String(body.category) },
    { $set: update },
  )
  if (result.matchedCount === 0) return error('budget row not found', 404)
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.month || !body.category) return error('month, category required')

  const coll = await getCollection('budgets', scope)
  const result = await coll.deleteOne({ month: String(body.month), category: String(body.category) })
  if (result.deletedCount === 0) return error('budget row not found', 404)
  return json({ ok: true })
}
