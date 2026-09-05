import type { ReactNode } from 'react'
import Link from 'next/link'
import { Fredoka, Nunito } from 'next/font/google'
import '../../src/expense-redesign.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

/** Public, unauthenticated shell for /legal/* — reachable with no session (see middleware.ts). */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`expense-redesign legal-page ${fredoka.variable} ${nunito.variable}`}>
      <div className="legal-shell">
        <Link href="/" className="legal-back">
          ✉️ Envelope
        </Link>
        {children}
        <nav className="legal-footer-nav" aria-label="Legal pages">
          <Link href="/legal/privacy">Privacy Policy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/delete-account">Delete your account</Link>
        </nav>
      </div>
    </div>
  )
}
