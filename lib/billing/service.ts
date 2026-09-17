/**
 * Billing persistence: starting the trial clock, and reading the current
 * access decision for a user.
 *
 * Everything here is server-owned. No function takes a trial date, plan,
 * paid flag, or billing owner id from a caller — the only input is a user id
 * already verified by `lib/access.ts`.
 */
import type { Db } from 'mongodb'
import { getDb } from '../mongodb'
import { getSystemSettings } from '../systemSettings'
import type { UserDoc } from '../users'
import { INCOME_CATEGORY } from '@/src/lib/envelope'
import {
  BILLING_ACCOUNTS,
  BILLING_SUBSCRIPTIONS,
  type BillingAccountDoc,
  type BillingSubscriptionDoc,
  type TrialCohort,
} from './records'
import { pickSubscription, resolveAccess, trialWindow, type Access } from './access'

/**
 * Start the 45-day clock, once, for good.
 *
 * `$setOnInsert` under the unique `_id` is the whole concurrency story: two
 * simultaneous onboarding completions, a reinstall, a logout/login, or a
 * migration rerun all collapse into the same first write. A device clock,
 * a client body, and a retried request cannot move these dates.
 *
 * Returns the account as it now stands — the existing one if a trial was
 * already granted.
 */
export async function startTrial(
  db: Db,
  userId: string,
  cohort: TrialCohort,
  now: Date = new Date(),
): Promise<BillingAccountDoc> {
  const { trialStartedAt, trialEndsAt } = trialWindow(now)
  const result = await db.collection<BillingAccountDoc>(BILLING_ACCOUNTS).findOneAndUpdate(
    { _id: userId },
    { $setOnInsert: { _id: userId, trialStartedAt, trialEndsAt, trialCohort: cohort, createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  )
  return result!
}

/** Did this account actually persist an initial budget setup? */
export async function hasCompletedSetup(db: Db, userId: string): Promise<boolean> {
  const live = { user_id: userId, deleted_at: null }
  const [budget, category] = await Promise.all([
    db.collection('budgets').findOne({ ...live, category: INCOME_CATEGORY }, { projection: { _id: 1 } }),
    db.collection('categories').findOne(live, { projection: { _id: 1 } }),
  ])
  return Boolean(budget && category)
}

/**
 * The account's current access decision.
 *
 * Reads the local verified projection only. A budgeting request must never
 * call the payment provider — purchases, webhooks and the reconciliation job
 * are what refresh these rows.
 */
export async function getAccess(userId: string, now: Date = new Date()): Promise<Access> {
  const db = await getDb()
  const [account, subs, settings] = await Promise.all([
    db.collection<BillingAccountDoc>(BILLING_ACCOUNTS).findOne({ _id: userId }),
    db.collection<BillingSubscriptionDoc>(BILLING_SUBSCRIPTIONS).find({ userId }).toArray(),
    getSystemSettings(),
  ])
  return resolveAccess({
    now,
    account,
    subscription: pickSubscription(subs, now),
    enforced: settings.billing.enforced,
  })
}

export type CompleteOnboardingResult =
  | { ok: true; onboardedAt: string; account: BillingAccountDoc }
  | { ok: false; reason: 'setup_incomplete' }

/**
 * The server-owned completion action: the one place a trial can begin.
 *
 * Order is deliberate. The trial is granted *before* the user is marked
 * onboarded, so a failure between the two leaves a retryable state
 * (un-onboarded, trial already granted and idempotent) rather than an
 * onboarded account with no clock — which the resolver would read as setup
 * still incomplete.
 *
 * The caller's supplied timestamp is ignored everywhere: the completion
 * instant is server UTC, so a device clock, a reinstall, or a replayed
 * request cannot move it.
 */
export async function completeOnboarding(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<CompleteOnboardingResult> {
  if (!(await hasCompletedSetup(db, userId))) return { ok: false, reason: 'setup_incomplete' }

  const account = await startTrial(db, userId, 'onboarding-v1', now)

  // Only stamped once: re-running completion must not move a date the app
  // already showed the user, or reorder them in the admin list.
  const onboardedAt = now.toISOString()
  const users = db.collection<UserDoc>('users')
  await users.updateOne({ _id: userId, onboardedAt: { $in: [null, undefined] } }, { $set: { onboardedAt } })
  const user = await users.findOne({ _id: userId }, { projection: { onboardedAt: 1 } })

  return { ok: true, onboardedAt: user?.onboardedAt ?? onboardedAt, account }
}
