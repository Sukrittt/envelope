import { json, error, readBody, getCollection } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const url = new URL(req.url)
  const scope = getScope(url)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name || typeof body.toIndex !== 'number') return error('name, toIndex required')

  const coll = await getCollection('categories', scope)
  const current = await coll.findOne({ name: String(body.name) })
  if (!current) return error('category not found', 404)

  const group = current.group ?? ''
  const groupDocs = await coll.find({ group }).sort({ order: 1 }).toArray()
  const names = groupDocs.map((d) => d.name)
  const fromPos = names.indexOf(String(body.name))
  if (fromPos < 0) return error('category group not found', 404)
  if (body.toIndex < 0 || body.toIndex >= names.length) return error('toIndex out of range', 400)

  const rest = names.filter((n) => n !== body.name)
  rest.splice(body.toIndex, 0, String(body.name))

  const minOrder = Math.min(...groupDocs.map((d) => (typeof d.order === 'number' ? d.order : 0)))
  await coll.bulkWrite(
    rest.map((name, i) => ({
      updateOne: { filter: { name }, update: { $set: { order: minOrder + i } } },
    })),
  )
  return json({ ok: true })
}
