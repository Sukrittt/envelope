import {
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Fredoka, Nunito } from 'next/font/google'
import { Radar } from 'lucide-react'
import { startSignIn, useAccessMode } from '../services/accessMode'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

/**
 * Sign-in gate. Auth state comes from the WorkOS session, so there is nothing
 * to restore or persist here — `useAccessMode()` reports 'guest' while the
 * session is still loading and flips to 'real' once a user resolves.
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
            <button type="button" className="action-button auth-unlock" onClick={startSignIn}>
              Sign in
            </button>
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
