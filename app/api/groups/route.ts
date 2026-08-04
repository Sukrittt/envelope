import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const coll = await getCollection('groups', scope)
  const docs = await coll.find({}).toArray()
  return json(docs.map((d) => d.name).filter(Boolean))
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('groups', scope)
  const exists = await coll.findOne({ name: String(body.name) })
  if (exists) return error('group already exists', 409)
  await coll.insertOne({ name: String(body.name) })
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('groups', scope)
  const existing = await coll.findOne({ name: String(body.name) })
  if (!existing) return error('group not found', 404)

  if (body.newName) {
    const newName = String(body.newName)
    await coll.updateOne({ name: String(body.name) }, { $set: { name: newName } })
    const catColl = await getCollection('categories', scope)
    await catColl.updateMany({ group: String(body.name) }, { $set: { group: newName } })
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

  const coll = await getCollection('groups', scope)
  const result = await coll.deleteOne({ name: String(body.name) })
  if (result.deletedCount === 0) return error('group not found', 404)

  const catColl = await getCollection('categories', scope)
  await catColl.updateMany({ group: String(body.name) }, { $set: { group: '' } })
  return json({ ok: true })
}
