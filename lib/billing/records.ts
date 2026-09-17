/**
 * Billing records — selling access to Envelope.
 *
 * Deliberately namespaced `billing_*`. The existing `subscriptions`
 * collection (and `lib/subscriptions.ts`) is a *user's own* recurring
 * expenses — Netflix, Spotify — and has nothing to do with paying us.
 *
 * Product baseline: ../../pricing.md, design: ../../payment-subscriptions-plan.md.
 */
import type { ObjectId } from 'mongodb'

export const BILLING_ACCOUNTS = 'billing_accounts'
export const BILLING_SUBSCRIPTIONS = 'billing_subscriptions'
export const BILLING_EVENTS = 'billing_events'

/** Trial length. 45 × 24h of real time, not 45 calendar days. */
export const TRIAL_DAYS = 45

/**
 * Which trial-granting rule created an account's dates. Recorded so a
 * migration rerun (or a policy change later) can tell cohorts apart and
 * never restarts a clock that already ran.
 */
export type TrialCohort = 'onboarding-v1' | 'legacy-launch-v1'

/**
 * One per paying identity, keyed by the WorkOS user id — the same id
 * `lib/access.ts` resolves from a bearer token or a session cookie. Trial
 * dates here are server-owned and immutable: only ever written with
 * `$setOnInsert`, never from a client body.
 */
export interface BillingAccountDoc {
  _id: string
  trialStartedAt: Date
  trialEndsAt: Date
  trialCohort: TrialCohort
  /** When budgeting data becomes eligible for deletion. Set by the retention job (phase 5), cleared on renewal. */
  retentionDeadline?: Date | null
  createdAt: Date
}

/** Verified store subscription status, mapped from the provider's own lifecycle. */
export type SubscriptionStatus =
  | 'active'
  /** User turned off auto-renew; still entitled until `expiresAt`. */
  | 'cancelled'
  /** Payment failed, store is retrying; Google keeps the user entitled. */
  | 'grace'
  /** Grace elapsed, store suspended the subscription. Not entitled. */
  | 'on_hold'
  | 'paused'
  | 'expired'
  | 'revoked'
  /** Slow payment method (UPI mandate, carrier billing) not yet settled. Grants nothing. */
  | 'pending'

/**
 * A purchase, as verified against the provider — never as reported by a
 * client. One row per store purchase; `storeTransactionId` is unique per
 * provider+environment so the same purchase cannot entitle two accounts.
 */
export interface BillingSubscriptionDoc {
  _id: ObjectId
  userId: string
  provider: 'revenuecat'
  environment: 'production' | 'sandbox'
  store: 'play'
  productId: string
  basePlanId: string | null
  storeTransactionId: string
  status: SubscriptionStatus
  autoRenew: boolean
  /** End of the paid (or grace) entitlement. Null only while `pending`. */
  expiresAt: Date | null
  /** Last time this row was confirmed against the provider, not the last webhook received. */
  verifiedAt: Date
  providerRefs: { customerId?: string; entitlementId?: string; originalTransactionId?: string }
  createdAt: Date
  updatedAt: Date
}

/**
 * Received provider notifications. Unique on provider+environment+eventId so
 * a duplicate delivery is a no-op insert rather than a second state change.
 */
export interface BillingEventDoc {
  _id: ObjectId
  provider: 'revenuecat'
  environment: 'production' | 'sandbox'
  eventId: string
  type: string
  userId: string | null
  receivedAt: Date
  processedAt: Date | null
  state: 'received' | 'processed' | 'failed'
  attempts: number
  error?: string
  /** Minimized payload — identifiers and lifecycle fields only, never a full receipt. */
  summary: Record<string, unknown>
}
