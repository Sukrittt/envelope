// Subscription access, as the server sees it. Twin of Mobile/src/api/billing.ts.
//
// The web app never runs Google Play checkout — purchases happen in the
// Android app and this recognizes the resulting entitlement on the same
// Envelope account.
import type { UserProfile } from './account'
import { apiFetch } from './client'

export interface BillingStatus {
  mode: 'setup_incomplete' | 'trial' | 'paid' | 'expired'
  /** May the account use normal budgeting, reports, AI and writes? */
  allowed: boolean
  /** False while the server's enforcement flag is off — `allowed` is then true regardless of mode. */
  enforced: boolean
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialDaysRemaining: number
  productId: string | null
  basePlanId: string | null
  paidExpiresAt: string | null
  autoRenew: boolean
  renewalState: 'active' | 'cancelled' | 'grace' | 'on_hold' | 'paused' | 'expired' | 'revoked' | 'pending' | null
  retentionDeadline: string | null
  purchaseEnabled: boolean
  /** Present and false when a sync returned stale data because the provider was unreachable. */
  refreshed?: boolean
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const resp = await apiFetch('/api/billing/status')
  if (!resp.ok) throw new Error(`Failed to load billing status: ${resp.status}`)
  return resp.json()
}

/**
 * "Refresh subscription status" — for someone who bought in the Android app
 * and wants the browser to catch up without waiting for the webhook.
 *
 * A 503 means RevenueCat was unreachable and the body is the *existing*
 * access, unchanged. Deliberately not thrown: an outage must not look like a
 * cancellation.
 */
export async function syncBilling(): Promise<BillingStatus> {
  const resp = await apiFetch('/api/billing/sync', { method: 'POST' })
  if (resp.status === 503) return resp.json()
  if (!resp.ok) throw new Error(`Failed to refresh subscription: ${resp.status}`)
  return resp.json()
}

/**
 * Finish onboarding server-side. This is what starts the 45-day trial, so
 * the date is the server's, not the browser's — call it after the initial
 * budget writes have landed, or it refuses.
 */
export async function completeOnboarding(): Promise<{ onboardedAt: string; user: UserProfile; access: BillingStatus }> {
  const resp = await apiFetch('/api/onboarding/complete', { method: 'POST' })
  if (!resp.ok) throw new Error(`Failed to complete onboarding: ${resp.status}`)
  return resp.json()
}
