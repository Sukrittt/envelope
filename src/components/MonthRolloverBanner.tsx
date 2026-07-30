import { useState } from 'react'

interface Props {
  currentMonth: string
  lastMonth: string
  lastIncome: number
  lastAssignments: Array<{ category: string; assigned: number }>
  onConfirm: (income: number, copyAssigned: boolean) => void
  onDismiss: () => void
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1] || m} ${y}`
}

export function MonthRolloverBanner({ currentMonth, lastMonth, lastIncome, lastAssignments, onConfirm, onDismiss }: Props) {
  const [income, setIncome] = useState(String(lastIncome))
  const [copyAssigned, setCopyAssigned] = useState(true)

  function handleConfirm() {
    const parsed = parseInt(income) || 0
    onConfirm(parsed, copyAssigned)
  }

  return (
    <div className="rollover-banner">
      <div className="rollover-banner-main">
        <div className="rollover-banner-text">
          <span className="rollover-banner-title">Start {monthLabel(currentMonth)}</span>
          <span className="rollover-banner-sub">
            Set up your budget for {monthLabel(currentMonth)}.
            {lastMonth && <span> Last month: {monthLabel(lastMonth)}.</span>}
          </span>
        </div>

        <div className="rollover-banner-fields">
          <label className="rollover-banner-field">
            <span>Monthly income</span>
            <input
              type="number"
              className="rollover-banner-input"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              placeholder="e.g. 85000"
            />
            {lastIncome > 0 && (
              <span className="rollover-banner-hint">Last month: {formatCurrency(lastIncome)}</span>
            )}
          </label>

          <label className="rollover-banner-check">
            <input
              type="checkbox"
              checked={copyAssigned}
              onChange={(e) => setCopyAssigned(e.target.checked)}
            />
            <span>Copy last month's assigned amounts as starting point</span>
          </label>
        </div>

        {copyAssigned && lastAssignments.length > 0 && (
          <div className="rollover-banner-preview">
            <span className="rollover-banner-preview-label">Starting assigned total: {formatCurrency(lastAssignments.reduce((s, a) => s + a.assigned, 0))}</span>
          </div>
        )}

        <div className="rollover-banner-actions">
          <button type="button" className="action-button is-active" onClick={handleConfirm}>
            Start {monthLabel(currentMonth)}
          </button>
          <button type="button" className="action-button is-ghost" onClick={onDismiss}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
