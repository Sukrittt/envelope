import type { BillingStatus } from '@/src/api/billing'

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sukrit04.envelope'

/** Reminder thresholds, in days remaining. Matches payment-subscriptions-plan.md. */
export const REMINDER_DAYS = [7, 3, 1]

/**
 * Whether the trial countdown is worth showing yet. Silent for the first
 * five and a half weeks: a banner that is always there is a banner nobody
 * reads by the time it matters.
 */
export function shouldWarnAboutTrial(status: BillingStatus | undefined): boolean {
  return status?.mode === 'trial' && status.trialDaysRemaining <= REMINDER_DAYS[0]
}

/**
 * Whether billing is worth mentioning at all. Before launch both server flags
 * are off and nobody has paid, so the app keeps its pre-launch copy instead of
 * a countdown to nothing. Mirrors Mobile's billingVisible.
 */
export function billingVisible(status: BillingStatus | undefined): boolean {
  return !!status && (status.enforced || status.purchaseEnabled || status.mode === 'paid')
}

/** One line for the account page's Plan & billing row. Mirrors Mobile's planSummary. */
export function planSummary(status: BillingStatus): string {
  switch (status.mode) {
    case 'trial':
      return `Free trial · ${trialRemainingLabel(status.trialDaysRemaining)}`
    case 'paid':
      if (status.renewalState === 'grace') return 'Payment issue · fix in Google Play'
      return status.autoRenew ? `Renews ${formatDate(status.paidExpiresAt)}` : `Ends ${formatDate(status.paidExpiresAt)}`
    case 'expired':
      return status.trialEndsAt && !status.productId ? 'Trial ended' : 'Subscription ended'
    default:
      return 'Finish setup to start your trial'
  }
}

/** "3 days left", "Last day" — the phrase used everywhere the trial is mentioned. */
export function trialRemainingLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Last day'
  if (daysRemaining === 1) return '1 day left'
  return `${daysRemaining} days left`
}

/**
 * Why the account is locked, in the user's terms. Each case names something
 * the user can act on — "your payment did not go through" is useful, "status:
 * on_hold" is not.
 */
export function lockedReason(status: BillingStatus | undefined): string {
  switch (status?.renewalState) {
    case 'on_hold':
      return 'Your subscription is on hold because a payment did not go through. Updating your payment method in Google Play restores access.'
    case 'paused':
      return 'Your subscription is paused. You can resume it from Google Play.'
    case 'revoked':
      return 'Your subscription was refunded, so it no longer provides access.'
    case 'pending':
      return 'Your payment is still being confirmed. This can take a little while with some payment methods — no need to pay again.'
    default:
      return status?.mode === 'expired' && status.trialEndsAt && !status.productId
        ? 'Your 45-day free trial has ended. Subscribe to carry on budgeting.'
        : 'Your subscription has ended. Subscribe to carry on budgeting.'
  }
}

/** Human date, e.g. "2 November 2026". Undefined input renders as an em dash. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}
