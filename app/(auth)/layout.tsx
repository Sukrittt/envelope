import type { ReactNode } from 'react'
import '../../src/expense-redesign.css'

/** Shared chrome for /sign-in, /email, /code: a centered card over two soft drifting blobs. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="expense-redesign auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-blob auth-blob--gold" />
        <div className="auth-blob auth-blob--mint" />
        <div className="auth-blob auth-blob--gold-2" />
        <div className="auth-blob auth-blob--mint-2" />
      </div>
      {children}
    </div>
  )
}
