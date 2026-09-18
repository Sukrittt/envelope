import { getDb } from '../mongodb'
import { getSystemSettings } from '../systemSettings'
import type { UserDoc } from '../users'

export interface BillingFlags {
  enforced: boolean
  purchaseEnabled: boolean
}

const OFF: BillingFlags = { enforced: false, purchaseEnabled: false }

/**
 * The billing switches as they apply to one user. Every server read of
 * `enforced` / `purchaseEnabled` goes through here, so the testers-only
 * audience cannot be bypassed by a route that reads the raw settings.
 *
 * Both switches off costs no database read — requireAccess sits on every
 * app route, and that is the normal pre-launch state.
 */
export async function billingFlagsFor(userId: string): Promise<BillingFlags> {
  const { billing } = await getSystemSettings()
  const flags = { enforced: billing.enforced, purchaseEnabled: billing.purchaseEnabled }
  if (!flags.enforced && !flags.purchaseEnabled) return OFF
  if (billing.audience === 'everyone') return flags

  const db = await getDb()
  const tester = await db
    .collection<UserDoc>('users')
    .findOne({ _id: userId, billingTester: true }, { projection: { _id: 1 } })
  return tester ? flags : OFF
}
