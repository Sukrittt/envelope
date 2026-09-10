'use client'

import { useMemo, type ReactNode } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Sun, Moon, Github } from 'lucide-react'
import { useAppearance } from './AppearanceProvider'

// Only routes that render this shell's topbar need an entry. Every other route
// sets skipChrome below and draws its own header.
const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/investments': {
    title: 'Investments',
    subtitle: 'Net worth, allocation, and holdings tracker',
  },
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const { theme, setTheme, density } = useAppearance()

  const currentMeta = useMemo(() => pageMeta[pathname], [pathname])

  const isExpenseRoute = pathname.startsWith('/expense') || pathname === '/insights' || pathname.startsWith('/investments')
  // Expense redesign routes carry their own chrome (sidebar, greeting, theme
  // toggle, mobile tabbar), so skip the legacy mission-control topbar/footer.
  const isErdRoute = pathname === '/expense' || pathname.startsWith('/expense/') || pathname === '/insights'
  // Auth, onboarding, and account pages are full-bleed layouts with their own
  // chrome too (auth card, tour, nav rail) — same treatment as ERD routes.
  const isStandaloneRoute =
    pathname === '/sign-in' ||
    pathname === '/email' ||
    pathname === '/code' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/legal')
  const skipChrome = isErdRoute || isStandaloneRoute || !currentMeta

  return (
    <main
      // No theme class until the browser resolves one: src/theme/tokens.css
      // paints from prefers-color-scheme meanwhile, so a system-light user
      // never sees a dark first frame.
      className={`mc-page ${theme ? `theme-${theme}` : ''} density-${density} ${isExpenseRoute ? 'expense-shell' : ''}`}
    >
      <div className="mc-layout">
        <section className="mc-main">
          {!skipChrome && currentMeta && (
            <header className="mc-topbar">
              <div className="page-context">
                <h2>{currentMeta.title}</h2>
                <p>{currentMeta.subtitle}</p>
              </div>
              <div className="utility-cluster">
                <button
                  type="button"
                  className="action-button theme-toggle"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  aria-label="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </header>
          )}

          {children}

          {!skipChrome && (
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
                <Image
                  className="app-footer-claude"
                  src="/claude_code.webp"
                  alt=""
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
                <span>claude-code</span>
              </a>
              <span aria-hidden="true">&middot;</span>
              <a href="/legal/privacy" className="app-footer-link">
                Privacy
              </a>
              <a href="/legal/terms" className="app-footer-link">
                Terms
              </a>
            </footer>
          )}
        </section>
      </div>
    </main>
  )
}
