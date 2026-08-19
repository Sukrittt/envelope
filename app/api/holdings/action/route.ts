import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name || !body.action || body.amount === undefined) {
    return error('name, action, amount required')
  }

  const holdingsColl = await getCollection('holdings', auth)
  const holding = await holdingsColl.findOne({ name: String(body.name) })
  if (!holding) return error('holding not found', 404)

  const prevValue = Number(holding.value) || 0
  const amount = Number(body.amount) || 0
  let newValue: number
  switch (body.action) {
    case 'market_update':
      newValue = Math.max(0, amount)
      break
    case 'contribution':
      newValue = prevValue + amount
      break
    case 'withdrawal':
      newValue = Math.max(0, prevValue - amount)
      break
    default:
      return error('invalid action', 400)
  }

  await holdingsColl.updateOne(
    { name: String(body.name) },
    { $set: { value: String(newValue), updated_at: new Date().toISOString() } },
  )
  invalidate('holdings', auth.userId)

  // Contributions/withdrawals move money in/out of Ready to Assign.
  if ((body.action === 'contribution' || body.action === 'withdrawal') && body.month) {
    const budgetColl = await getCollection('budgets', auth)
    const budget = await budgetColl.findOne({ month: String(body.month), category: '__income__' })
    if (budget) {
      const currentIncome = Number(budget.assigned) || 0
      const delta = body.action === 'contribution' ? -amount : amount
      await budgetColl.updateOne(
        { _id: budget._id },
        { $set: { assigned: String(Math.max(0, currentIncome + delta)) } },
      )
      invalidate('budgets', auth.userId)
    }
  }

  const eventsColl = await getCollection('holding_events', auth)
  await eventsColl.insertOne({
    holding_name: String(body.name),
    event_type: String(body.action),
    amount: String(body.amount),
    previous_value: String(prevValue),
    new_value: String(newValue),
    timestamp: new Date().toISOString(),
  })
  invalidate('holdingEvents', auth.userId)

  return json({ ok: true, previousValue: prevValue, newValue })
}
