import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useAppearance } from '../../components/AppearanceProvider'
import { TransactionsView } from '../components/TransactionsView'
import { ExpenseSidebar } from '../components/ExpenseSidebar'
import { useBudgets } from '../hooks/useBudgets'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { useGroups } from '../hooks/useGroups'
import { computeEnvelopeState, currentMonthKey } from '../lib/envelope'
import { EMPTY } from '../lib/constants'

export function TransactionsPage() {
  // The sidebar wants this month's income and spend, which is all this page
  // took the whole expense-panel contract for.
  const budgets = useBudgets().data ?? EMPTY
  const expenses = useExpenses().data ?? EMPTY
  const categories = useCategories().data ?? EMPTY
  const groups = useGroups().data ?? EMPTY
  const month = currentMonthKey()
  const envelopeState = useMemo(
    () => computeEnvelopeState(budgets, expenses, month, categories, groups),
    [budgets, expenses, month, categories, groups],
  )
  const { theme, setTheme } = useAppearance()

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
          Activity <span>🧾</span>
        </div>
        <div className="erd-mobile-sub">
          <span>Every transaction you have logged</span>
        </div>
      </header>

      <div className="erd-main">
        <ExpenseSidebar
          onMoveMoney={() => {}}
          onShowCategories={() => {}}
          month={month}
          income={envelopeState.income}
          totalSpent={envelopeState.totalSpent}
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
        <Link href="/account" className="erd-tab">
          <span aria-hidden="true">⚙️</span>
          <span>More</span>
        </Link>
      </nav>
    </section>
  )
}
