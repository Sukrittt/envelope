import Link from 'next/link'

export const metadata = { title: 'Sign in — Mission Control' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>
}) {
  const { authError } = await searchParams
  return (
    <div className="auth-card">
      <div className="auth-logo" aria-hidden="true">
        ✉️
      </div>
      <h1 className="auth-headline">
        Every rupee
        <br />
        in an envelope.
      </h1>
      <p className="auth-subhead">
        Sign in with a one-time code or Google. No passwords to remember, ever.
      </p>
      {authError && (
        <p className="auth-error" role="alert">
          That sign-in link expired or was invalid. Please try again.
        </p>
      )}

      <div className="auth-actions">
        <a href="/api/auth/google" className="auth-btn auth-btn--outline">
          <span className="auth-google-mark" aria-hidden="true">
            G
          </span>
          Continue with Google
        </a>
        <Link href="/email" className="auth-btn auth-btn--primary">
          Continue with email
        </Link>
        <p className="auth-legal">
          By continuing you agree to the <a href="/legal/terms">Terms</a> and{' '}
          <a href="/legal/privacy">Privacy Policy</a>.
          <br />
          Free and open source. Your amounts and notes are encrypted before they reach our database.
        </p>
      </div>
    </div>
  )
}
