'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CodeForm() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [resent, setResent] = useState(false)

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
      setError('Wrong or expired code.')
      return
    }
    // Full navigation: AuthKitProvider and the rest of the app read the
    // session cookie fresh, same as the old AuthGate's post-verify reload.
    window.location.href = '/expense'
  }

  async function resend() {
    setResent(false)
    setError('')
    const res = await fetch('/api/auth/magic-auth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) setResent(true)
    else setError('Could not resend the code. Try again in a moment.')
  }

  return (
    <div className="auth-card">
      <button
        type="button"
        className="auth-back"
        aria-label="Back"
        onClick={() => router.push(`/email`)}
      >
        ←
      </button>
      <h1 className="auth-headline">Check your inbox</h1>
      <p className="auth-subhead">
        Code sent to <strong>{email || 'your email'}</strong>
      </p>

      <form className="auth-actions" onSubmit={verifyCode}>
        <input
          className="auth-code-field"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        {error ? <div className="auth-field-error">{error}</div> : null}
        <button
          type="button"
          className="auth-resend"
          onClick={resend}
        >
          {resent ? 'Code resent.' : "Didn't get it? Resend code"}
        </button>
        <button type="submit" className="auth-btn auth-btn--primary" disabled={pending || code.length < 6}>
          {pending ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  )
}

export default function CodePage() {
  return (
    <Suspense fallback={<div className="auth-card" />}>
      <CodeForm />
    </Suspense>
  )
}
