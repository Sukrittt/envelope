'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useAppearance } from './AppearanceProvider'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const { theme, density } = useAppearance()

  // Every route draws its own chrome (sidebar, headers, tabbar); this shell
  // only carries the theme/density classes and the expense nav flag.
  const isExpenseRoute = pathname.startsWith('/expense') || pathname === '/insights' || pathname.startsWith('/investments')

  return (
    <main
      // No theme class until the browser resolves one: src/theme/tokens.css
      // paints from prefers-color-scheme meanwhile, so a system-light user
      // never sees a dark first frame.
      className={`mc-page ${theme ? `theme-${theme}` : ''} density-${density} ${isExpenseRoute ? 'expense-shell' : ''}`}
    >
      <div className="mc-layout">
        <section className="mc-main">{children}</section>
      </div>
    </main>
  )
}
