import type { ReactNode } from 'react'
import { Fredoka, Nunito } from 'next/font/google'
import '../../src/expense-redesign.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

/** Shared chrome for /sign-in, /email, /code: a centered card over two soft drifting blobs. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`expense-redesign auth-page ${fredoka.variable} ${nunito.variable}`}>
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-blob auth-blob--gold" />
        <div className="auth-blob auth-blob--mint" />
      </div>
      {children}
    </div>
  )
}
