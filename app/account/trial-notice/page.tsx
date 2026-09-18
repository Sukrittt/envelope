'use client'

import { useRouter } from 'next/navigation'
import { useBillingStatus } from '@/src/hooks/useBillingStatus'
import { formatDate } from '@/src/components/billing/copy'

/**
 * Shown once, right after the guided tour finishes a fresh onboarding, and again from the account page's Plan & billing row before billing is live. Twin of
 * Mobile's app/account/trial-notice.tsx: sets expectations about the trial
 * instead of leaving the new user to find out on day 45.
 */
export default function TrialNoticePage() {
  const router = useRouter()
  const { data } = useBillingStatus()
  const dated = data?.mode === 'trial' && !!data.trialEndsAt

  return (
    <div className="trial-notice">
      <div className="trial-notice-badge">✨</div>
      <h1 className="trial-notice-title">You&apos;re on the trial plan</h1>
      <p className="trial-notice-body">
        {dated
          ? `Everything's free until ${formatDate(data.trialEndsAt)}. No card needed, nothing to cancel.`
          : "Everything's free while you try it out. No card needed, nothing to cancel."}
      </p>
      <div className="trial-notice-card">
        <strong>What happens when it ends</strong>
        <p>
          We&apos;ll remind you a week before. Then you can subscribe in the Android app. Nothing is charged
          automatically, and you can always export your data for free.
        </p>
      </div>
      <button type="button" className="setup-cta" onClick={() =>
          // Opened from the account page's Plan & billing row, "Got it" goes
          // back there; right after onboarding it hands off to the app.
          new URLSearchParams(window.location.search).get('from') === 'more' ? router.back() : router.replace('/expense')
        }>
        Got it
      </button>
    </div>
  )
}
