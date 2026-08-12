import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppearance } from '../../components/AppearanceProvider'
import { TransactionsView } from '../components/TransactionsView'
import { ExpenseSidebar } from '../components/ExpenseSidebar'
import { toExpensePanelData, type ExpensePanelData } from '../services/expensePanelAdapter'
import { loadExpensePanelContract } from '../services/expensePanelLoader'

export function TransactionsPage() {
  const [panel, setPanel] = useState<ExpensePanelData | null>(null)
  const { theme, setTheme } = useAppearance()

  useEffect(() => {
    loadExpensePanelContract().then((contract) => {
      const data = toExpensePanelData(contract)
      setPanel(data)
    })
  }, [])

  return (
    <section className="expense-redesign">
      <button
        type="button"
        className="erd-theme-toggle"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <header className="erd-mobile-header">
        <div className="erd-mobile-greet">
          Hey Sukrit <span>👋</span>
        </div>
        <div className="erd-mobile-sub">
          <span>Check out all your transactions</span>
        </div>
      </header>

      <div className="erd-main">
        <ExpenseSidebar
          onMoveMoney={() => {}}
          onShowCategories={() => {}}
          month={panel?.month}
          income={panel?.envelopeState?.income}
          totalSpent={panel?.envelopeState?.totalSpent}
        />
        <div className="erd-content">
          <Suspense fallback={<div className="txn-timeline-loading">Loading…</div>}>
            <TransactionsView />
          </Suspense>
        </div>
      </div>

      <nav className="erd-tabbar" aria-label="Primary">
        <Link href="/expense" className="erd-tab">
          <span aria-hidden="true">🏠</span>
          <span>Home</span>
        </Link>
        <Link href="/expense/transactions" className="erd-tab is-active">
          <span aria-hidden="true">🧾</span>
          <span>Activity</span>
        </Link>
        <Link href="/settings" className="erd-tab">
          <span aria-hidden="true">⚙️</span>
          <span>More</span>
        </Link>
      </nav>
    </section>
  )
}
