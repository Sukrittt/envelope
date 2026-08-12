'use client'

import { useMemo, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sun, Moon, Github } from 'lucide-react'
import { useAppearance } from './AppearanceProvider'

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/expense': {
    title: 'Hey Sukrit 👋',
    subtitle: "What's your dashboard looking like today?",
  },
  '/expense/transactions': {
    title: 'Hey Sukrit 👋',
    subtitle: 'Check out all your transactions',
  },
  '/fitness': {
    title: 'Fitness Dashboard',
    subtitle: 'Body metrics, adherence, and training execution',
  },
  '/learnings': {
    title: 'Agent Learnings',
    subtitle: 'What each department/agent is learning over time',
  },
  '/investments': {
    title: 'Investments',
    subtitle: 'Net worth, allocation, and holdings tracker',
  },
  '/settings': {
    title: 'Settings',
    subtitle: 'Appearance, density, and operations preferences',
  },
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const { theme, setTheme, density } = useAppearance()

  const currentMeta = useMemo(
    () => pageMeta[pathname] ?? pageMeta['/expense'],
    [pathname],
  )

  const isExpenseRoute = pathname.startsWith('/expense') || pathname.startsWith('/investments')
  // Expense redesign routes carry their own chrome (sidebar, greeting, theme
  // toggle, mobile tabbar), so skip the legacy mission-control topbar/footer.
  const isErdRoute = pathname === '/expense' || pathname.startsWith('/expense/')

  return (
    <main
      className={`mc-page theme-${theme} density-${density} ${isExpenseRoute ? 'expense-shell' : ''}`}
    >
      <div className="mc-layout">
        <section className="mc-main">
          {!isErdRoute && (
            <header className="mc-topbar">
              <div className="page-context">
                <h2>{currentMeta.title}</h2>
                <p>{currentMeta.subtitle}</p>
              </div>
              <div className="utility-cluster">
                <button
                  type="button"
                  className="action-button theme-toggle"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </header>
          )}

          {children}

          {!isErdRoute && (
            <footer className="app-footer">
              <span>Built by</span>
              <a
                href="https://github.com/sukrittt"
                target="_blank"
                rel="noreferrer"
                className="app-footer-link"
              >
                <Github size={14} aria-hidden="true" />
                <span>sukrittt</span>
              </a>
              <span>and</span>
              <a
                href="https://github.com/anthropics/claude-code"
                target="_blank"
                rel="noreferrer"
                className="app-footer-link"
              >
                <img
                  className="app-footer-claude"
                  src="/claude_code.webp"
                  alt=""
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
                <span>claude-code</span>
              </a>
            </footer>
          )}
        </section>
      </div>
    </main>
  )
}
