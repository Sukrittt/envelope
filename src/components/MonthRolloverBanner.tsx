import { useState } from 'react'
import { SuccessButton, useButtonPhase } from './SuccessButton'

interface Props {
  currentMonth: string
  lastMonth: string
  lastIncome: number
  lastAssignments: Array<{ category: string; assigned: number }>
  onConfirm: (income: number, copyAssigned: boolean) => Promise<void>
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
  const { saving, success, start, succeed, fail } = useButtonPhase()

  async function handleConfirm() {
    if (saving || success) return
    const parsed = parseInt(income) || 0
    start()
    try {
      await onConfirm(parsed, copyAssigned)
      succeed(onDismiss)
    } catch {
      fail()
    }
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
            <span>Copy last month&apos;s assigned amounts as starting point</span>
          </label>
        </div>

        {copyAssigned && lastAssignments.length > 0 && (
          <div className="rollover-banner-preview">
            <span className="rollover-banner-preview-label">Starting assigned total: {formatCurrency(lastAssignments.reduce((s, a) => s + a.assigned, 0))}</span>
          </div>
        )}

        <div className="rollover-banner-actions">
          <SuccessButton
            type="button"
            className="is-active"
            disabled={saving || success}
            saving={saving}
            success={success}
            onClick={handleConfirm}
          >
            Start {monthLabel(currentMonth)}
          </SuccessButton>
          <button type="button" className="action-button is-ghost" onClick={onDismiss}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  )
}
