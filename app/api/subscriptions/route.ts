import { json, error, readBody, getCollection, escapeRegExp, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { SUBSCRIPTION_HEADERS, toRow } from '@/lib/models'
import { invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('subscriptions', auth)
  const docs = await coll.find({}).toArray()
  return json({ headers: SUBSCRIPTION_HEADERS, rows: docs.map((d) => toRow(SUBSCRIPTION_HEADERS, d)) })
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.service || !body.amount_inr) return error('service, amount_inr required')

  const coll = await getCollection('subscriptions', auth)
  const exists = await coll.findOne({
    service: { $regex: new RegExp(`^${escapeRegExp(String(body.service))}$`, 'i') },
  })
  if (exists) return error('subscription already exists', 409)

  await coll.insertOne({
    timestamp: String(body.timestamp || nowIST().timestamp),
    service: String(body.service),
    amount_inr: String(body.amount_inr),
    billing_cycle: String(body.billing_cycle || 'monthly'),
    next_due_date: String(body.next_due_date ?? ''),
    status: 'active',
    renewal_or_end_month: String(body.renewal_or_end_month ?? ''),
    notes: String(body.notes ?? ''),
    category: String(body.category ?? ''),
  })
  invalidate('subscriptions', auth.userId)
  return json({ ok: true })
}

export async function PUT(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'PUT')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.service) return error('service required')

  // Case-insensitive match, consistent with the POST duplicate check and DELETE below.
  const coll = await getCollection('subscriptions', auth)
  const existing = await coll.findOne({
    service: { $regex: new RegExp(`^${escapeRegExp(String(body.service))}$`, 'i') },
  })
  if (!existing) return error('subscription not found', 404)

  const update: Record<string, string> = {}
  if (body.new_service !== undefined) update.service = String(body.new_service)
  if (body.amount_inr !== undefined) update.amount_inr = String(body.amount_inr)
  if (body.billing_cycle !== undefined) update.billing_cycle = String(body.billing_cycle)
  if (body.next_due_date !== undefined) update.next_due_date = String(body.next_due_date)
  if (body.notes !== undefined) update.notes = String(body.notes)
  if (body.status !== undefined) update.status = String(body.status)
  if (body.renewalOrEndMonth !== undefined) update.renewal_or_end_month = String(body.renewalOrEndMonth)
  if (body.category !== undefined) update.category = String(body.category)

  if (body.status === 'cancelled' && body.renewalOrEndMonth === undefined) {
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + 1)
    update.renewal_or_end_month = expiry.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (body.status === 'active' && body.renewalOrEndMonth === undefined) {
    update.renewal_or_end_month = ''
  }

  await coll.updateOne({ _id: existing._id }, { $set: update })
  invalidate('subscriptions', auth.userId)
  return json({ ok: true })
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'DELETE')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.service) return error('service required')

  // Case-insensitive match, consistent with the POST duplicate check.
  const coll = await getCollection('subscriptions', auth)
  const result = await coll.deleteOne({
    service: { $regex: new RegExp(`^${escapeRegExp(String(body.service))}$`, 'i') },
  })
  if (result.deletedCount === 0) return error('subscription not found', 404)
  invalidate('subscriptions', auth.userId)
  return json({ ok: true })
}
