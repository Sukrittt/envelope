import { Link, useLocation } from 'react-router-dom'

interface Props {
  onMoveMoney: () => void
  onShowCategories: () => void
  month?: string
  income?: number
  totalSpent?: number
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function daysLeftInMonth(): string {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const left = lastDay - now.getDate()
  return `${left} day${left !== 1 ? 's' : ''} left`
}

export function ExpenseSidebar({ onMoveMoney, onShowCategories, month, income, totalSpent }: Props) {
  const { pathname } = useLocation()
  const isTransactions = pathname === '/expense/transactions'

  return (
    <nav className="expense-sidebar">
      <Link to="/expense" className="expense-sidebar-brand">Expense</Link>

      <div className="expense-sidebar-summary">
        {month && <span className="ess-month">{month}</span>}
        <div className="ess-row">
          <span className="ess-label">Income</span>
          <span className="ess-value">{income != null ? formatCurrency(income) : '—'}</span>
        </div>
        <div className="ess-row">
          <span className="ess-label">Spent</span>
          <span className="ess-value">{totalSpent != null ? formatCurrency(totalSpent) : '—'}</span>
        </div>
        <div className="ess-row">
          <span className="ess-label">Left</span>
          <span className="ess-value">{daysLeftInMonth()}</span>
        </div>
      </div>

      <div>
        <div className="expense-sidebar-group-label">Views</div>
        <Link
          to="/expense"
          className={`expense-sidebar-link ${!isTransactions ? 'is-active' : ''}`}
        >
          <span className="expense-sidebar-link-icon">◈</span>
          Dashboard
        </Link>
        <Link
          to="/expense/transactions"
          className={`expense-sidebar-link ${isTransactions ? 'is-active' : ''}`}
        >
          <span className="expense-sidebar-link-icon">↕</span>
          Transactions
        </Link>
      </div>

      <div>
        <div className="expense-sidebar-group-label">Envelopes</div>
        <button type="button" className="expense-sidebar-link" onClick={onShowCategories}>
          <span className="expense-sidebar-link-icon">▤</span>
          Categories
        </button>
        <button type="button" className="expense-sidebar-link" onClick={onMoveMoney}>
          <span className="expense-sidebar-link-icon">⇄</span>
          Move money
        </button>
      </div>
    </nav>
  )
}
