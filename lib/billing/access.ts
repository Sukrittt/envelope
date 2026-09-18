/**
 * The entitlement resolver. One decision function, shared by every platform:
 * authentication says *who* you are, this says *what you may do*.
 *
 * Pure on purpose — no DB, no provider calls, no `Date.now()`. Callers pass
 * the records and the instant. That makes every boundary (the 45-day edge,
 * grace, hold, a pending purchase) testable without a database, and stops
 * anyone reaching for the payment provider on a budgeting request.
 */
import { TRIAL_DAYS, type BillingAccountDoc, type BillingSubscriptionDoc, type SubscriptionStatus } from './records'

const DAY_MS = 24 * 60 * 60 * 1000

/** The immutable trial window for a trial started at `startedAt`. Exactly 45 × 24h of real time. */
export function trialWindow(startedAt: Date): { trialStartedAt: Date; trialEndsAt: Date } {
  return { trialStartedAt: startedAt, trialEndsAt: new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS) }
}

/**
 * Statuses that still entitle the user, provided the entitlement has not
 * expired. `cancelled` is in here deliberately: turning off auto-renew ends
 * the *billing*, not the access already paid for. `on_hold`, `paused`,
 * `expired`, `revoked` and `pending` are not — a payment the store has not
 * settled grants nothing.
 */
const ENTITLING: readonly SubscriptionStatus[] = ['active', 'cancelled', 'grace']

export type AccessMode = 'setup_incomplete' | 'trial' | 'paid' | 'expired'

export interface Access {
  mode: AccessMode
  /** May the account use normal budgeting, reports, AI and writes? */
  allowed: boolean
  /** False while the enforcement flag is off — `allowed` is then true regardless of `mode`. */
  enforced: boolean
  trialStartedAt: string | null
  trialEndsAt: string | null
  /** Whole days left in the trial, floored; 0 once it has ended. */
  trialDaysRemaining: number
  productId: string | null
  basePlanId: string | null
  paidExpiresAt: string | null
  autoRenew: boolean
  /** The verified store status, surfaced so the client can say *why* (grace, on hold, pending). */
  renewalState: SubscriptionStatus | null
  retentionDeadline: string | null
}

export interface AccessInput {
  now: Date
  account: BillingAccountDoc | null
  /** The account's most relevant verified purchase, or null. See `pickSubscription`. */
  subscription: BillingSubscriptionDoc | null
  /** `false` until the launch flag flips — resolve honestly, block nothing. */
  enforced: boolean
}

function subscriptionEntitles(sub: BillingSubscriptionDoc | null, now: Date): boolean {
  if (!sub || !ENTITLING.includes(sub.status)) return false
  return sub.expiresAt !== null && sub.expiresAt.getTime() > now.getTime()
}

/**
 * Resolve what an account may do right now.
 *
 * Order matters: a paid entitlement wins over a trial (so a user who bought
 * early is never told their trial ran out), and the absence of a billing
 * account means onboarding never completed — the trial is created by that
 * action, so no account means no clock has started.
 */
export function resolveAccess({ now, account, subscription, enforced }: AccessInput): Access {
  const paid = subscriptionEntitles(subscription, now)
  const trial = account !== null && account.trialEndsAt.getTime() > now.getTime()

  // ponytail: a legacy user who onboarded before billing shipped has no
  // billing account and reads as `setup_incomplete` until the launch
  // migration grants one. Safe only because enforcement stays off until that
  // migration has run — see scripts/billing-launch-migration.mjs.
  const mode: AccessMode = paid ? 'paid' : trial ? 'trial' : account === null ? 'setup_incomplete' : 'expired'

  const msLeft = account ? account.trialEndsAt.getTime() - now.getTime() : 0

  return {
    mode,
    allowed: enforced ? mode === 'paid' || mode === 'trial' : true,
    enforced,
    trialStartedAt: account?.trialStartedAt.toISOString() ?? null,
    trialEndsAt: account?.trialEndsAt.toISOString() ?? null,
    trialDaysRemaining: Math.max(0, Math.floor(msLeft / DAY_MS)),
    productId: subscription?.productId ?? null,
    basePlanId: subscription?.basePlanId ?? null,
    paidExpiresAt: subscription?.expiresAt?.toISOString() ?? null,
    autoRenew: subscription?.autoRenew ?? false,
    renewalState: subscription?.status ?? null,
    retentionDeadline: account?.retentionDeadline?.toISOString() ?? null,
  }
}

/**
 * Pick the purchase that decides access when an account has several rows
 * (an upgrade, a re-subscribe after expiry, a sandbox row alongside a real
 * one). The one that entitles the user for longest wins; if none entitles,
 * the most recently verified is kept so the client can explain the failure.
 */
export function pickSubscription(subs: BillingSubscriptionDoc[], now: Date): BillingSubscriptionDoc | null {
  if (subs.length === 0) return null
  const entitling = subs.filter((s) => subscriptionEntitles(s, now))
  if (entitling.length > 0) {
    return entitling.reduce((best, s) => (s.expiresAt!.getTime() > best.expiresAt!.getTime() ? s : best))
  }
  return subs.reduce((best, s) => (s.verifiedAt.getTime() > best.verifiedAt.getTime() ? s : best))
}
