import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getAccess } from '@/lib/billing/service'
import { getSystemSettings } from '@/lib/systemSettings'

export const dynamic = 'force-dynamic'

/**
 * The client's single source of truth for what this account may do, and what
 * to offer it next. Read-only, and served from the locally verified
 * projection — it never calls the payment provider.
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const [access, settings] = await Promise.all([getAccess(auth.userId), getSystemSettings()])
  return json({ ...access, purchaseEnabled: settings.billing.purchaseEnabled })
}
