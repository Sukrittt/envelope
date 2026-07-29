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

function daysLeftInMonth(): number {
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return lastDay - now.getDate()
}

export function ExpenseSidebar({ onMoveMoney, onShowCategories, month, income, totalSpent }: Props) {
  return (
    <nav className="expense-sidebar">
      <div className="expense-sidebar-brand">Expense</div>

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
          <span className="ess-value">{daysLeftInMonth()} days</span>
        </div>
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
