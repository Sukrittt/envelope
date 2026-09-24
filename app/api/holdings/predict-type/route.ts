import { json, error, readBody } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { pickHoldingType } from '@/lib/ai/jev'
import { isRateLimited } from '@/lib/rateLimit'
import { aiDisabledResponse } from '@/lib/systemSettings'
import { aiAllowanceResponse } from '@/lib/ai/allowance'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RATE_WINDOW_MS = 60 * 60 * 1000
const SIGNED_IN_LIMIT = 60
const BURST_WINDOW_MS = 60 * 1000
const BURST_LIMIT = 20
const MAX_NAME_LEN = 200
const MAX_TYPES = 20
const MAX_TYPE_LEN = 60

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const aiOff = await aiDisabledResponse()
  if (aiOff) return aiOff

  const overAllowance = await aiAllowanceResponse(auth)
  if (overAllowance) return overAllowance

  const body = await readBody(req)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME_LEN) : ''
  const rawTypes = Array.isArray(body.types) ? body.types : null

  if (!name) return error('name required')
  if (
    !rawTypes ||
    rawTypes.length === 0 ||
    rawTypes.length > MAX_TYPES ||
    !rawTypes.every((t) => typeof t === 'string' && t && t.length <= MAX_TYPE_LEN)
  )
    return error('types must be a non-empty string array')

  const limited = await isRateLimited(`holding-type-suggest:${auth.userId}`, [
    { windowMs: BURST_WINDOW_MS, limit: BURST_LIMIT },
    { windowMs: RATE_WINDOW_MS, limit: SIGNED_IN_LIMIT },
  ])
  if (limited) return error('rate limited', 429)

  const type = await pickHoldingType(name, rawTypes as string[], { userId: auth.userId, feature: 'suggest' }).catch(
    () => null,
  )
  if (type === null) return error('type suggestion failed', 502)

  return json({ type })
}
