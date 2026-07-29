import type { Envelope } from '../types/expense'

interface Props {
  envelope: Envelope
  hideAmounts: boolean
  onMoveMoney: (category: string) => void
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function BudgetEnvelopeCard({ envelope, hideAmounts, onMoveMoney }: Props) {
  const { category, assigned, spent, available, isOverspent, spentPct } = envelope

  const barColor = isOverspent ? 'var(--risk-fg, #ff8b9a)' : spentPct > 85 ? 'var(--warn-fg, #ffd166)' : '#5ee6a8'

  return (
    <div className={`envelope-card ${isOverspent ? 'envelope-overspent' : ''}`}>
      <div className="envelope-header">
        <span className="envelope-category">{category}</span>
        {isOverspent && <span className="envelope-badge">Overspent</span>}
      </div>

      <div className="envelope-numbers">
        <div className="envelope-number">
          <span className="envelope-number-label">Assigned</span>
          <span className="envelope-number-value">{hideAmounts ? '---' : formatCurrency(assigned)}</span>
        </div>
        <div className="envelope-number">
          <span className="envelope-number-label">Spent</span>
          <span className="envelope-number-value">{hideAmounts ? '---' : formatCurrency(spent)}</span>
        </div>
        <div className="envelope-number">
          <span className="envelope-number-label">Available</span>
          <span className={`envelope-number-value ${isOverspent ? 'envelope-negative' : ''}`}>
            {hideAmounts ? '---' : formatCurrency(available)}
          </span>
        </div>
      </div>

      <div className="envelope-progress-wrap">
        <div
          className="envelope-progress-bar"
          style={{ width: `${Math.min(100, spentPct)}%`, background: barColor }}
        />
      </div>

      <div className="envelope-footer">
        <span className="envelope-pct" style={{ color: barColor }}>
          {Math.round(spentPct)}%
        </span>
        {isOverspent && (
          <button type="button" className="envelope-move-money" onClick={() => onMoveMoney(category)}>
            Move money →
          </button>
        )}
      </div>
    </div>
  )
}
