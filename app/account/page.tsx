'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useAppearance } from '../../components/AppearanceProvider'
import { useHideAmounts } from '../../src/hooks/useHideAmounts'
import { clearLocalPrefs } from '../../src/lib/localPref'
import { useMoneyBrain } from '../../components/MoneyBrainProvider'

type NotifyCadence = 'off' | 'weekly' | 'daily'

interface UserDoc {
  email: string
  name: string | null
  avatarUrl: string | null
  notifyCadence?: NotifyCadence
}

export default function AccountPage() {
  const { user } = useAuth()
  const { preference, setPreference } = useAppearance()
  const { openMoneyBrain } = useMoneyBrain()
  const [hideAmounts, setHideAmounts] = useHideAmounts()
  const [doc, setDoc] = useState<UserDoc | null>(null)
  const [notifyCadence, setNotifyCadence] = useState<NotifyCadence>('off')

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

  const name = doc?.name || 'You'
  const email = doc?.email ?? user?.email ?? ''
  const initial = name.trim().charAt(0).toUpperCase() || 'U'

  return (
    <>
      <div className="account-profile-card">
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
          <div className="account-profile-email">{email}</div>
        </div>
      </div>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Features
        </div>
        <div className="account-feature-grid">
          <Link href="/wrapped" className="account-feature-card">
            <span className="account-feature-icon" style={{ background: 'var(--coral-soft)' }} aria-hidden="true">
              🎁
            </span>
            <span className="account-feature-title">Expense Wrapped</span>
            <span className="account-feature-copy">Your month as a story</span>
          </Link>
          <button type="button" className="account-feature-card" onClick={() => openMoneyBrain()}>
            <span className="account-feature-icon" style={{ background: 'var(--gold-soft)' }} aria-hidden="true">
              🧠
            </span>
            <span className="account-feature-title">Money Brain</span>
            <span className="account-feature-copy">Ask your budget anything</span>
          </button>
          <Link href="/investments" className="account-feature-card">
            <span className="account-feature-icon" style={{ background: 'var(--mint-soft)' }} aria-hidden="true">
              📈
            </span>
            <span className="account-feature-title">Investments</span>
            <span className="account-feature-copy">Portfolio at a glance</span>
          </Link>
          <Link href="/account/recurring" className="account-feature-card">
            <span className="account-feature-icon" style={{ background: 'var(--violet-soft)' }} aria-hidden="true">
              🔁
            </span>
            <span className="account-feature-title">Recurring</span>
            <span className="account-feature-copy">Rent, the gym, logged for you</span>
          </Link>
        </div>
      </div>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Preferences
        </div>
        <div className="account-card">
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label">Appearance</span>
            <div className="account-segmented" role="group" aria-label="Theme">
              {/* Matches Mobile's three options; "Auto" is the 'system'
                  preference, which web had no way to pick before. */}
              {(
                [
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'Auto' },
                ] as const
              ).map((opt) => (
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
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label">Hide amounts</span>
            <div className="account-segmented" role="group" aria-label="Hide amounts">
              <button type="button" className={!hideAmounts ? 'is-active' : ''} onClick={() => setHideAmounts(false)}>
                Show
              </button>
              <button type="button" className={hideAmounts ? 'is-active' : ''} onClick={() => setHideAmounts(true)}>
                Hide
              </button>
            </div>
          </div>
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-label">Notifications</span>
            <div className="account-segmented" role="group" aria-label="Notification cadence">
              {(['off', 'weekly', 'daily'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={notifyCadence === opt ? 'is-active' : ''}
                  onClick={() => updateCadence(opt)}
                >
                  {opt === 'off' ? 'Off' : opt === 'weekly' ? 'Weekly' : 'Daily'}
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
          <Link href="/account/security" className="account-row">
            <span className="account-row-icon" aria-hidden="true">
              🔐
            </span>
            <span className="account-row-label">Account &amp; security</span>
            <span className="account-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link href="/account/data" className="account-row">
            <span className="account-row-icon" aria-hidden="true">
              🗂️
            </span>
            <span className="account-row-label">Your data</span>
            <span className="account-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link href="/account/archive" className="account-row">
            <span className="account-row-icon" aria-hidden="true">
              🗃️
            </span>
            <span className="account-row-label">Archive</span>
            <span className="account-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <div className="account-row" style={{ cursor: 'default' }}>
            <span className="account-row-icon" aria-hidden="true" style={{ opacity: 0.5 }}>
              💳
            </span>
            <span className="account-row-label" style={{ color: 'var(--erd-text3)', textDecoration: 'line-through' }}>
              Plan &amp; billing
            </span>
            <span className="account-badge">Free &amp; open source</span>
          </div>
          <Link href="/account/help" className="account-row">
            <span className="account-row-icon" aria-hidden="true">
              💬
            </span>
            <span className="account-row-label">Help &amp; feedback</span>
            <span className="account-row-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>

      {/* onClick runs before the navigation, so browser-local preferences are
          dropped on the way out — otherwise the next account signed in here
          inherits this one's collapsed groups and recent categories. The plain
          href stays the mechanism, so sign-out still works without JS. */}
      <a href="/logout" className="account-signout-btn" onClick={() => clearLocalPrefs()}>
        Sign out
      </a>
    </>
  )
}
