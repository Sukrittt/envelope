'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Archive, Brain, Compass, Database, History, Lock, MessageCircle, Repeat, UserRound } from 'lucide-react'
import '../../src/expense-redesign.css'

const NAV = [
  { href: '/account', label: 'You', icon: UserRound },
  { href: '/account/security', label: 'Security', icon: Lock },
  { href: '/account/data', label: 'Your data', icon: Database },
  { href: '/account/recurring', label: 'Recurring', icon: Repeat },
  { href: '/account/archive', label: 'Archive', icon: Archive },
  { href: '/account/bill-scans', label: 'Bills Scanned', icon: History },
  { href: '/account/chat-history', label: 'Chat history', icon: Brain },
  { href: '/account/guided-tour', label: 'How this works', icon: Compass },
  { href: '/account/help', label: 'Help', icon: MessageCircle },
]

export default function AccountLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''

  return (
    <div className="expense-redesign account-shell">
      <h1 className="account-shell-title">Account</h1>
      <div className="account-body">
        <nav className="account-rail" aria-label="Account sections">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`account-rail-link ${pathname === item.href || (item.href === '/account/help' && pathname === '/account/feedback') ? 'is-active' : ''}`}
            >
              <item.icon size={16} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="account-panel">{children}</div>
      </div>
    </div>
  )
}
