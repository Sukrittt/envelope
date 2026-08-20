import Link from 'next/link'

export const metadata = { title: 'Sign in — Mission Control' }

export default function SignInPage() {
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
          By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
          <br />
          Free and open source — your data stays yours.
        </p>
      </div>
    </div>
  )
}
