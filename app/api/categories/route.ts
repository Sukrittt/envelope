import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const coll = await getCollection('categories', scope)
  const docs = await coll.find({}).sort({ order: 1 }).toArray()
  return json(
    docs
      .map((d) => ({ name: d.name ?? '', group: d.group ?? '' }))
      .filter((c) => c.name),
  )
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('categories', scope)
  const maxDoc = await coll.find({}).sort({ order: -1 }).limit(1).next()
  const order = (maxDoc && typeof maxDoc.order === 'number' ? maxDoc.order : 0) + 1
  await coll.insertOne({ name: String(body.name), group: String(body.group ?? ''), order })
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('categories', scope)
  const existing = await coll.findOne({ name: String(body.name) })
  if (!existing) return error('category not found', 404)

  let effectiveName = String(body.name)
  if (body.newName && body.newName !== body.name) {
    effectiveName = String(body.newName)
    await coll.updateOne({ name: String(body.name) }, { $set: { name: effectiveName } })

    // Cascade the rename to budgets + expenses so history stays consistent.
    const budgetColl = await getCollection('budgets', scope)
    await budgetColl.updateMany({ category: String(body.name) }, { $set: { category: effectiveName } })

    const expenseColl = await getCollection('expenses', scope)
    await expenseColl.updateMany({ category: String(body.name) }, { $set: { category: effectiveName } })
  }

  if (body.group !== undefined) {
    await coll.updateOne({ name: effectiveName }, { $set: { group: String(body.group) } })
  }

  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('categories', scope)
  const result = await coll.deleteOne({ name: String(body.name) })
  if (result.deletedCount === 0) return error('category not found', 404)
  return json({ ok: true })
}
