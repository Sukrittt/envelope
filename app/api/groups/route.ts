import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { cachedRead, invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('groups', auth)
  const docs = await cachedRead('groups', auth.userId, () => coll.find({}).toArray())
  return json(docs.map((d) => d.name).filter(Boolean))
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('groups', auth)
  const exists = await coll.findOne({ name: String(body.name) })
  if (exists) return error('group already exists', 409)
  await coll.insertOne({ name: String(body.name) })
  invalidate('groups', auth.userId)
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('groups', auth)
  const existing = await coll.findOne({ name: String(body.name) })
  if (!existing) return error('group not found', 404)

  if (body.newName) {
    const newName = String(body.newName)
    await coll.updateOne({ name: String(body.name) }, { $set: { name: newName } })
    const catColl = await getCollection('categories', auth)
    await catColl.updateMany({ group: String(body.name) }, { $set: { group: newName } })
    invalidate('categories', auth.userId)
  }
  invalidate('groups', auth.userId)
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('groups', auth)
  const result = await coll.deleteOne({ name: String(body.name) })
  if (result.deletedCount === 0) return error('group not found', 404)

  const catColl = await getCollection('categories', auth)
  await catColl.updateMany({ group: String(body.name) }, { $set: { group: '' } })
  invalidate('categories', auth.userId)
  invalidate('groups', auth.userId)
  return json({ ok: true })
}
