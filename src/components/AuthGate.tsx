import {
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Radar, Eye, EyeOff } from 'lucide-react'
import { accessMode, persistAccess, readPersistedAccess } from '../services/accessMode'
import { useDashboard } from '../context/useDashboard'

const DASHBOARD_PASSWORD = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD as string | undefined

type GateStatus = 'checking' | 'locked' | 'guest' | 'real'

export function AuthGate({ children }: { children: ReactNode }) {
  const { reload } = useDashboard()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [status, setStatus] = useState<GateStatus>('checking')
  const [sessionKey, setSessionKey] = useState<'guest' | 'real'>('guest')

  // Restore a persisted access session only after hydration. Reading
  // localStorage in a render-phase initializer would make the server (no
  // storage) and client (has storage) render different trees, causing a
  // hydration mismatch that leaves the gate's form handlers unattached.
  useEffect(() => {
    const persisted = readPersistedAccess()
    if (persisted) {
      persistAccess(persisted) // refresh the rolling 30-day window
      setStatus(persisted)
      setSessionKey(persisted)
    } else if (!DASHBOARD_PASSWORD) {
      persistAccess('real')
      setStatus('real')
      setSessionKey('real')
    } else {
      accessMode.set('guest')
      setStatus('locked')
    }
  }, [])

  useEffect(() => {
    return accessMode.subscribeLogout(() => {
      // Re-lock the gate and fall back to a guest (demo) backdrop — never real data.
      setPassword('')
      setError(null)
      setShakeKey((n) => n + 1)
      setSessionKey('guest')
      setStatus('locked')
    })
  }, [])

  function handleUnlock(event: FormEvent) {
    event.preventDefault()
    if (password === DASHBOARD_PASSWORD) {
      setError(null)
      persistAccess('real')
      setStatus('real')
      setSessionKey('real')
      void reload()
    } else {
      setError('Incorrect password. Try again.')
      setShakeKey((n) => n + 1)
    }
  }

  function continueAsGuest() {
    setError(null)
    persistAccess('guest')
    setStatus('guest')
    setSessionKey('guest')
  }

  // Remount the children when switching access modes so they refetch the right data.
  const keyedChildren = isValidElement(children)
    ? cloneElement(children as ReactElement, { key: sessionKey })
    : children

  return (
    <>
      {status === 'checking' ? (
        <div className="auth-gate-overlay" aria-busy="true" aria-label="Checking access" />
      ) : status === 'locked' ? (
        <div
          className="auth-gate-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard is locked"
        >
          <div className={`auth-dialog${error ? ' is-error' : ''}`} key={shakeKey}>
            <div className="auth-heading">
              <div className="auth-heading-icon" aria-hidden="true">
                <Radar size={18} />
              </div>
              <h1 className="auth-title">YNAB Replacement</h1>
            </div>
            <p className="auth-subtitle">
              Private dashboard. Enter your password, or explore with sample data instead.
            </p>
            <form className="auth-form" onSubmit={handleUnlock}>
              <div className="auth-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-password"
                  placeholder="Password"
                  value={password}
                  autoFocus
                  autoComplete="current-password"
                  aria-label="Password"
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="action-button auth-unlock">
                Unlock
              </button>
            </form>
            <div className="auth-divider" aria-hidden="true" />
            <button type="button" className="auth-guest" onClick={continueAsGuest}>
              Not Sukrit? Continue as guest
            </button>
          </div>
        </div>
      ) : null}
      {status === 'checking' ? null : keyedChildren}
    </>
  )
}
