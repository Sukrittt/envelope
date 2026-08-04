import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name || !body.direction) return error('name, direction required')

  const coll = await getCollection('categories', scope)
  const current = await coll.findOne({ name: String(body.name) })
  if (!current) return error('category not found', 404)

  const currentOrder = typeof current.order === 'number' ? current.order : 0
  const step = body.direction === 'up' ? -1 : 1
  const target = await coll
    .findOne({ group: current.group ?? '', order: step < 0 ? { $lt: currentOrder } : { $gt: currentOrder } }, { sort: { order: step } })
  if (!target) return error('no adjacent category to swap', 400)

  await coll.updateOne({ name: String(current.name) }, { $set: { order: target.order } })
  await coll.updateOne({ name: String(target.name) }, { $set: { order: currentOrder } })
  return json({ ok: true })
}
