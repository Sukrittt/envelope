'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fredoka, Nunito } from 'next/font/google'
import '../../src/expense-redesign.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

const NAV = [
  { href: '/account', label: 'You', icon: '👤' },
  { href: '/account/security', label: 'Security', icon: '🔐' },
  { href: '/account/data', label: 'Your data', icon: '🗂️' },
  { href: '/account/help', label: 'Help', icon: '💬' },
]

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''

  return (
    <div className={`expense-redesign account-shell ${fredoka.variable} ${nunito.variable}`}>
      <h1 className="account-shell-title">Account</h1>
      <div className="account-body">
        <nav className="account-rail" aria-label="Account sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`account-rail-link ${pathname === item.href ? 'is-active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="account-panel">{children}</div>
      </div>
    </div>
  )
}
