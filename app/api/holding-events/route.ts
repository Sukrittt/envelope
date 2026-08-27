import { json, getCollection } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { HOLDING_EVENT_HEADERS, toRow } from '@/lib/models'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('holding_events', auth)
  const docs = await coll.find({}).toArray()
  return json({ headers: HOLDING_EVENT_HEADERS, rows: docs.map((d) => toRow(HOLDING_EVENT_HEADERS, d)) })
}
