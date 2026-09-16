'use client'

import { CurrencySetting } from '@/src/components/CurrencyPicker'
import { useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence } from 'motion/react'
import {
  Archive,
  Brain,
  ChevronRight,
  Compass,
  CreditCard,
  Database,
  FileText,
  Gift,
  History,
  LineChart,
  Lock,
  MessageCircle,
  Receipt,
  Repeat,
  ScanLine,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useAppearance } from '../../components/AppearanceProvider'
import { useHideAmounts } from '../../src/hooks/useHideAmounts'
import { useWrappedStatus } from '../../src/hooks/useWrapped'
import { monthAbbrev, monthLabel, shiftMonthKey } from '../../src/lib/envelope'
import { useMoneyBrain } from '../../components/MoneyBrainProvider'
import { LogExpenseModal } from '../../src/components/LogExpenseModal'
import { ScanBillModal } from '../../src/features/scan-bill/ScanBillModal'
import { SignOutDialog } from '../../src/components/ConfirmDialog'
import type { WrappedStatus } from '../../src/api/wrapped'

type NotifyCadence = 'off' | 'weekly' | 'daily'

interface UserDoc {
  email: string
  name: string | null
  avatarUrl: string | null
  notifyCadence?: NotifyCadence
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
] as const

const NOTIFY_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
] as const

export default function AccountPage() {
  const { user } = useAuth()
  const { preference, setPreference } = useAppearance()
  const { openMoneyBrain } = useMoneyBrain()
  const [hideAmounts, setHideAmounts] = useHideAmounts()
  const wrappedStatus = useWrappedStatus().data
  const [doc, setDoc] = useState<UserDoc | null>(null)
  const [notifyCadence, setNotifyCadence] = useState<NotifyCadence>('off')
  const [showScan, setShowScan] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/user')
      if (!res.ok) return
      const data: UserDoc = await res.json()
      setDoc(data)
      setNotifyCadence(data.notifyCadence ?? 'off')
    })()
  }, [])

  async function updateCadence(next: NotifyCadence) {
    setNotifyCadence(next)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyCadence: next }),
    })
  }

  const email = doc?.email ?? user?.email ?? ''
  const name = doc?.name || email || 'You'
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const wrapped = wrappedCopy(wrappedStatus)

  return (
    <>
      <Link href="/account/security" className="account-profile-card">
        {doc?.avatarUrl ? (
          <Image
            className="account-avatar"
            src={doc.avatarUrl}
            alt=""
            width={52}
            height={52}
            unoptimized
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="account-avatar" aria-hidden="true">
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="account-profile-name">{name}</div>
          {email && <div className="account-profile-email">{email}</div>}
        </div>
        <ChevronRight size={16} className="account-row-arrow" aria-hidden="true" />
      </Link>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Features
        </div>
        <div className="account-feature-grid">
          <FeatureCard
            icon={Gift}
            tone="coral"
            label="Expense Wrapped"
            blurb={wrapped.blurb}
            href={wrapped.available ? '/wrapped' : undefined}
          />
          <FeatureCard icon={Brain} tone="gold" label="Money Brain" blurb="Ask about your spending" onClick={() => openMoneyBrain()} />
          <FeatureCard icon={TrendingUp} tone="mint" label="Investments" blurb="Portfolio at a glance" href="/investments" />
          <FeatureCard icon={ScanLine} tone="mint" label="Scan a bill" blurb="Split a cart or receipt" onClick={() => setShowScan(true)} />
          <FeatureCard icon={Repeat} tone="violet" label="Recurring expenses" blurb="Plan upcoming payments" href="/account/recurring" />
          <FeatureCard icon={Archive} tone="blue" label="Archive" blurb="Restore deleted items" href="/account/archive" />
          {/* Web has no standalone subscriptions screen; the panel lives on the home rail. */}
          <FeatureCard icon={Receipt} tone="violet" label="Subscriptions" blurb="What renews and when" href="/expense" />
          <FeatureCard icon={LineChart} tone="blue" label="Insights" blurb="Trends and breakdowns" href="/insights" />
        </div>
      </div>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Preferences
        </div>
        <div className="account-card">
          <CurrencySetting />
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label">Appearance</span>
            <div className="account-segmented" role="group" aria-label="Theme">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={preference === opt.value ? 'is-active' : ''}
                  onClick={() => setPreference(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <label className="account-row">
            <span className="account-row-label">
              Hide amounts
              <span className="account-row-hint">Blur balances when the app opens</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="account-switch"
              checked={hideAmounts}
              onChange={(e) => setHideAmounts(e.target.checked)}
            />
          </label>
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label">Notifications</span>
            <div className="account-segmented" role="group" aria-label="Notification cadence">
              {NOTIFY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={notifyCadence === opt.value ? 'is-active' : ''}
                  onClick={() => updateCadence(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Account
        </div>
        <div className="account-card">
          <AccountRow icon={Lock} label="Account & security" href="/account/security" />
          <AccountRow icon={Database} label="Your data" href="/account/data" />
          <AccountRow icon={History} label="Bills Scanned" href="/account/bill-scans" />
          <div className="account-row" style={{ cursor: 'default' }}>
            <CreditCard size={16} aria-hidden="true" style={{ opacity: 0.5 }} />
            <span className="account-row-label" style={{ color: 'var(--erd-text3)', textDecoration: 'line-through' }}>
              Plan &amp; billing
            </span>
            <a
              className="account-badge"
              href="https://github.com/Sukrittt/envelope-mobile"
              target="_blank"
              rel="noreferrer"
            >
              Free &amp; open source
            </a>
          </div>
          <AccountRow icon={Compass} label="How this works" href="/account/guided-tour" />
          <AccountRow icon={MessageCircle} label="Help & feedback" href="/account/help" />
          <AccountRow icon={FileText} label="Terms & privacy" href="/legal/privacy" />
        </div>
      </div>

      <button type="button" className="account-signout-btn" onClick={() => setConfirmSignOut(true)}>
        Sign out
      </button>

      <AnimatePresence>
        {confirmSignOut && <SignOutDialog onCancel={() => setConfirmSignOut(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showLog && <LogExpenseModal onClose={() => setShowLog(false)} onSaved={() => {}} />}
      </AnimatePresence>
      <AnimatePresence>
        {showScan && (
          <ScanBillModal
            onClose={() => setShowScan(false)}
            onEnterManually={() => {
              setShowScan(false)
              setShowLog(true)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

type Tone = 'coral' | 'gold' | 'mint' | 'violet' | 'blue'

function FeatureCard({
  icon: Icon,
  tone,
  label,
  blurb,
  href,
  onClick,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  blurb: ReactNode
  href?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="account-feature-icon" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone})` }} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="account-feature-title">{label}</span>
      {blurb}
    </>
  )
  if (href) {
    return (
      <Link href={href} className="account-feature-card">
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className="account-feature-card" onClick={onClick} disabled={!onClick}>
      {body}
    </button>
  )
}

function AccountRow({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link href={href} className="account-row">
      <Icon size={16} aria-hidden="true" />
      <span className="account-row-label">{label}</span>
      <ChevronRight size={16} className="account-row-arrow" aria-hidden="true" />
    </Link>
  )
}

/** Mirrors Mobile's wrappedCardProps: a dot tracker toward next month's unlock until Wrapped is ready. */
function wrappedCopy(status: WrappedStatus | undefined): { blurb: ReactNode; available: boolean } {
  if (!status) return { blurb: <span className="account-feature-copy">Checking last month…</span>, available: false }
  if (status.available) {
    return { blurb: <span className="account-feature-copy">Your {monthLabel(status.month)}, wrapped</span>, available: true }
  }
  const { currentMonth, currentMonthCount, minTransactions } = status
  const goalReached = currentMonthCount >= minTransactions
  const next = monthAbbrev(shiftMonthKey(currentMonth, 1))
  const filled = Math.min(currentMonthCount, minTransactions)
  return {
    available: false,
    blurb: (
      <span>
        <span className="account-feature-dots" style={{ color: goalReached ? 'var(--mint)' : 'var(--erd-text3)' }} aria-hidden="true">
          {'●'.repeat(filled) + '○'.repeat(minTransactions - filled)}
        </span>
        <span className="account-feature-copy">
          {goalReached ? `Wrap unlocks ${next} 1` : `${currentMonthCount}/${minTransactions} · unlocks ${next} 1`}
        </span>
      </span>
    ),
  }
}
