import { json, error, readBody, getCollection, escapeRegExp } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'
import { HOLDING_HEADERS, toRow } from '@/lib/models'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const coll = await getCollection('holdings', scope)
  const docs = await coll.find({}).toArray()
  return json({ headers: HOLDING_HEADERS, rows: docs.map((d) => toRow(HOLDING_HEADERS, d)) })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name || body.value === undefined) return error('name, value required')

  const coll = await getCollection('holdings', scope)
  const exists = await coll.findOne({
    name: { $regex: new RegExp(`^${escapeRegExp(String(body.name))}$`, 'i') },
  })
  if (exists) return error('holding already exists', 409)

  await coll.insertOne({
    name: String(body.name),
    type: String(body.type ?? ''),
    value: String(body.value),
    updated_at: String(body.updated_at || new Date().toISOString()),
  })
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('holdings', scope)
  const existing = await coll.findOne({ name: String(body.name) })
  if (!existing) return error('holding not found', 404)

  const update: Record<string, string> = {}
  if (body.new_name !== undefined) update.name = String(body.new_name)
  if (body.type !== undefined) update.type = String(body.type)
  if (body.value !== undefined) update.value = String(body.value)
  if (body.value !== undefined || body.updated_at !== undefined) {
    update.updated_at = String(body.updated_at || new Date().toISOString())
  }

  await coll.updateOne({ name: String(body.name) }, { $set: update })
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name) return error('name required')

  const coll = await getCollection('holdings', scope)
  const result = await coll.deleteOne({ name: String(body.name) })
  if (result.deletedCount === 0) return error('holding not found', 404)
  return json({ ok: true })
}
