'use client'

import { ExternalLink, RefreshCw } from 'lucide-react'
import { useBillingStatus, useSyncBilling } from '@/src/hooks/useBillingStatus'
import { billingVisible, formatDate, PLAY_STORE_URL, trialRemainingLabel } from './copy'

/**
 * Subscription status on the account page: what the plan is, when it renews
 * or ends, and how to change it.
 *
 * Cancelling and changing payment method both live in Google Play, not here —
 * that is where the subscription actually is, and pretending otherwise would
 * leave someone clicking a button in this app believing they had cancelled
 * when they had not.
 */
export function SubscriptionSection() {
  const { data, isLoading } = useBillingStatus()
  const sync = useSyncBilling()

  // Hidden entirely until subscriptions are switched on, so nobody is shown a
  // plan they cannot buy and a countdown that does not apply to them yet.
  if (isLoading || !data || !billingVisible(data)) return null

  return (
    <div id="subscription">
      <div className="account-section-label" style={{ marginBottom: 10 }}>
        Subscription
      </div>
      <div className="account-card">
        <div className="account-row" style={{ cursor: 'default' }}>
          <span className="account-row-label">
            Plan
            <span className="account-row-hint">{describePlan(data)}</span>
          </span>
          <span style={{ color: 'var(--tk-text2)', fontSize: 14 }}>{statusChip(data)}</span>
        </div>

        {data.renewalState === 'grace' && (
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label" style={{ color: 'var(--tk-warn)' }}>
              Payment problem
              <span className="account-row-hint">
                Google Play could not take the last payment. Update your payment method to avoid losing access.
              </span>
            </span>
          </div>
        )}

        <a className="account-row" href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
          <span className="account-row-label">
            Manage in Google Play
            <span className="account-row-hint">Change plan, update payment method, or cancel.</span>
          </span>
          <ExternalLink size={16} className="account-row-arrow" aria-hidden />
        </a>

        <button type="button" className="account-row" onClick={() => sync.mutate()} disabled={sync.isPending} style={{ width: '100%', textAlign: 'left' }}>
          <span className="account-row-label">
            Refresh subscription status
            <span className="account-row-hint">
              {sync.isSuccess && sync.data.refreshed === false
                ? 'Could not reach the store. Your access is unchanged.'
                : 'Use this if you just subscribed on your phone.'}
            </span>
          </span>
          <RefreshCw size={16} className="account-row-arrow" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function describePlan(data: { mode: string; trialEndsAt: string | null; paidExpiresAt: string | null; autoRenew: boolean; basePlanId: string | null }): string {
  if (data.mode === 'trial') return `Free trial ends ${formatDate(data.trialEndsAt)}`
  if (data.mode === 'paid') {
    const plan = data.basePlanId ? `${data.basePlanId} · ` : ''
    // "Renews" and "ends" are not interchangeable. Someone who cancelled needs
    // to see the date their access stops, not a renewal that is not coming.
    return `${plan}${data.autoRenew ? 'Renews' : 'Ends'} ${formatDate(data.paidExpiresAt)}`
  }
  return 'No active subscription'
}

function statusChip(data: { mode: string; trialDaysRemaining: number; renewalState: string | null }): string {
  if (data.mode === 'trial') return trialRemainingLabel(data.trialDaysRemaining)
  if (data.renewalState === 'grace') return 'Payment failed'
  if (data.renewalState === 'on_hold') return 'On hold'
  if (data.renewalState === 'paused') return 'Paused'
  if (data.renewalState === 'pending') return 'Pending'
  if (data.mode === 'paid') return 'Active'
  return 'Expired'
}
