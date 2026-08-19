import {
  cloneElement,
  isValidElement,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Fredoka, Nunito } from 'next/font/google'
import { Radar } from 'lucide-react'
import { useAccessMode } from '../services/accessMode'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

/** Inline email magic-auth: send a code, then verify it. No redirect, no password. */
function MagicAuthForm() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError('')
    const res = await fetch('/api/auth/magic-auth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setPending(false)
    if (!res.ok) return setError('Could not send code. Check the address and try again.')
    setStep('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError('')
    const res = await fetch('/api/auth/magic-auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) {
      setPending(false)
      return setError('Wrong or expired code.')
    }
    window.location.reload()
  }

  if (step === 'email') {
    return (
      <form className="auth-form" onSubmit={sendCode}>
        <input
          className="auth-password"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        {error ? <div className="auth-error">{error}</div> : null}
        <button type="submit" className="action-button auth-unlock" disabled={pending}>
          {pending ? 'Sending…' : 'Send code'}
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" onSubmit={verifyCode}>
      <p className="auth-subtitle">Enter the code sent to {email}.</p>
      <input
        className="auth-password"
        inputMode="numeric"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        autoFocus
      />
      {error ? <div className="auth-error">{error}</div> : null}
      <button type="submit" className="action-button auth-unlock" disabled={pending}>
        {pending ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  )
}

/**
 * Sign-in gate. Auth state comes from the WorkOS session, so there is nothing
 * to restore or persist here — `useAccessMode()` reports 'guest' while the
 * session is still loading and flips to 'real' once a user resolves.
 *
 * Google and email both authenticate inline: Google goes straight to Google's
 * consent screen (`/api/auth/google`, provider=GoogleOAuth skips the AuthKit
 * picker), email uses magic-auth codes via `/api/auth/magic-auth/*` — no
 * WorkOS-hosted sign-in page for either.
 *
 * "Continue as guest" only dismisses the gate. It grants nothing: the API
 * already serves unauthenticated requests as the read-only demo user, so the
 * data behind the dialog is demo data either way.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const access = useAccessMode()
  const [dismissed, setDismissed] = useState(false)

  const locked = access === 'guest' && !dismissed

  // Remount the children when switching access modes so they refetch the right data.
  const keyedChildren = isValidElement(children)
    ? cloneElement(children as ReactElement, { key: access })
    : children

  return (
    <>
      {locked ? (
        <div
          className="auth-gate-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard is locked"
        >
          <div className={`auth-dialog ${fredoka.variable} ${nunito.variable}`}>
            <div className="auth-heading">
              <div className="auth-heading-icon" aria-hidden="true">
                <Radar size={18} />
              </div>
              <h1 className="auth-title">YNAB Dashboard</h1>
            </div>
            <p className="auth-subtitle">
              Private dashboard. Sign in to see your data, or explore with sample data instead.
            </p>
            <a href="/api/auth/google" className="action-button auth-unlock">
              Continue with Google
            </a>
            <div className="auth-divider" aria-hidden="true" />
            <MagicAuthForm />
            <div className="auth-divider" aria-hidden="true" />
            <button type="button" className="auth-guest" onClick={() => setDismissed(true)}>
              Not Sukrit? Continue as guest
            </button>
          </div>
        </div>
      ) : null}
      {keyedChildren}
    </>
  )
}
