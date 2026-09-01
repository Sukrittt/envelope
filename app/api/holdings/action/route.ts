import { json, error, readBody } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { applyHoldingAction } from '@/lib/holdings'

export const dynamic = 'force-dynamic'

const ACTIONS = new Set(['market_update', 'contribution', 'withdrawal'])

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (!body.name || !body.action || body.amount === undefined) {
    return error('name, action, amount required')
  }
  const action = String(body.action)
  if (!ACTIONS.has(action)) return error('invalid action', 400)

  const result = await applyHoldingAction(auth, {
    name: String(body.name),
    action: action as 'market_update' | 'contribution' | 'withdrawal',
    amount: Number(body.amount) || 0,
  })
  if (!result.ok) return error(result.error, result.status)

  return json({ ok: true, previousValue: result.previousValue, newValue: result.newValue })
}
