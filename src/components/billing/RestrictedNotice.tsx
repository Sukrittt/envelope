'use client'

import Link from 'next/link'
import { Download, ExternalLink, Lock, RefreshCw, Settings } from 'lucide-react'
import { useBillingStatus, useSyncBilling } from '@/src/hooks/useBillingStatus'
import { formatDate, lockedReason, PLAY_STORE_URL } from './copy'

/**
 * Shown in place of the budgeting app when the account has no valid trial or
 * subscription.
 *
 * Every route out of here is deliberate. An expired user must be able to get
 * their data (pricing.md promises export without a subscription), manage or
 * delete their account, and pay — and nothing else. A dead end with only a
 * "Subscribe" button would be holding their own records hostage.
 *
 * There is no checkout on this page because there cannot be one: Google Play
 * requires purchases for in-app digital access to go through Play billing, so
 * the web app's job is to explain that clearly and send them to the Android
 * app, not to imitate a paywall it is not allowed to complete.
 */
export function RestrictedNotice() {
  const { data: status } = useBillingStatus()
  const sync = useSyncBilling()

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
        <div
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: 14,
            background: 'var(--tk-warn-soft)',
          }}
        >
          <Lock size={20} color="var(--tk-warn)" />
        </div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-fredoka), system-ui', fontSize: 26, color: 'var(--tk-text)' }}>
          Subscription needed
        </h1>
        <p style={{ margin: 0, color: 'var(--tk-text2)', lineHeight: 1.55 }}>{lockedReason(status)}</p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 14,
          padding: 18,
          borderRadius: 16,
          border: '1px solid var(--tk-border)',
          background: 'var(--tk-card-solid)',
        }}
      >
        <div>
          <strong style={{ color: 'var(--tk-text)' }}>Subscribe in the Android app</strong>
          <p style={{ margin: '6px 0 0', color: 'var(--tk-text2)', fontSize: 14, lineHeight: 1.5 }}>
            Payment goes through Google Play, so it happens on your phone. Sign in to the Android app with this same
            Aviary account and your subscription unlocks here too.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 999,
              background: 'var(--tk-accent)',
              color: 'var(--tk-on-accent)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open Google Play <ExternalLink size={15} aria-hidden />
          </a>
          {/* For someone who already paid on their phone and is waiting for
              this tab to catch up, rather than a second way to buy. */}
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid var(--tk-border-strong)',
              background: 'transparent',
              color: 'var(--tk-text)',
              fontWeight: 600,
              cursor: sync.isPending ? 'progress' : 'pointer',
            }}
          >
            <RefreshCw size={15} aria-hidden />
            {sync.isPending ? 'Checking…' : 'Already subscribed? Refresh'}
          </button>
        </div>
        {sync.isSuccess && !sync.data.allowed && (
          <p role="status" style={{ margin: 0, color: 'var(--tk-text3)', fontSize: 13 }}>
            {sync.data.refreshed === false
              ? 'Could not reach the store just now. Your access is unchanged — try again shortly.'
              : 'No active subscription found on this account yet.'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <ExitRoute
          href="/account/data"
          icon={<Download size={16} aria-hidden />}
          label="Export your data"
          hint={
            status?.retentionDeadline
              ? `Free, with or without a subscription. Your data is kept until ${formatDate(status.retentionDeadline)}.`
              : 'Free, with or without a subscription. Downloading your full history never needs a subscription.'
          }
        />
        <ExitRoute
          href="/account"
          icon={<Settings size={16} aria-hidden />}
          label="Account settings"
          hint="Change your email, sign out, or delete your account."
        />
      </div>
    </div>
  )
}

function ExitRoute({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        gap: 12,
        padding: 16,
        borderRadius: 14,
        border: '1px solid var(--tk-border)',
        background: 'var(--tk-card)',
        color: 'var(--tk-text)',
        textDecoration: 'none',
      }}
    >
      <span style={{ marginTop: 2, color: 'var(--tk-text2)' }}>{icon}</span>
      <span>
        <strong style={{ display: 'block' }}>{label}</strong>
        <span style={{ color: 'var(--tk-text2)', fontSize: 13, lineHeight: 1.5 }}>{hint}</span>
      </span>
    </Link>
  )
}
