import { useState } from 'react'
import { formatCurrency } from '@/lib/currency'

interface Props {
  income: number
  totalAssigned: number
  readyToAssign: number
  isOverAssigned: boolean
  onIncomeChange: (value: number) => void
  sparkData?: Array<{ date: string; value: number }>
  overspentCount: number
  totalEnvelopes: number
}

export function ReadyToAssignBanner({ income, totalAssigned, readyToAssign, isOverAssigned, onIncomeChange, sparkData, overspentCount, totalEnvelopes }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(income))

  function handleSave() {
    const parsed = Number(editValue)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onIncomeChange(parsed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  const assignedPct = totalAssigned > 0 ? Math.min(100, (totalAssigned / Math.max(income, 1)) * 100) : 0

  const maxSpark = sparkData && sparkData.length > 0
    ? Math.max(...sparkData.map((d) => d.value), 1)
    : 1

  return (
    <>
      <section className={`erd-card erd-rta-hero ${isOverAssigned ? 'is-negative' : ''}`}>
        <div className="erd-rta-label">
          <span className="erd-pulse-dot" />
          Ready to Assign
        </div>
        <div className={`erd-rta-amount ${isOverAssigned ? 'is-negative' : ''}`}>
          {formatCurrency(readyToAssign)}
        </div>
        {isOverAssigned && (
          <div className="erd-rta-warn">Over-assigned — reduce category budgets</div>
        )}
        {!isOverAssigned && readyToAssign === 0 && (
          <div className="erd-rta-ok">Every rupee has a job ✨</div>
        )}
        {!isOverAssigned && readyToAssign > 0 && (
          <div className="erd-rta-ok">{overspentCount} envelope{overspentCount === 1 ? '' : 's'} overspent</div>
        )}
        <div className="erd-rta-track">
          <div className="erd-rta-fill" style={{ width: `${assignedPct}%` }} />
        </div>
        <div className="erd-rta-hint">{Math.round(assignedPct)}% of income assigned</div>
      </section>

      <section className="erd-card erd-income-card">
        <div className="erd-income-top">
          <div>
            <div className="erd-income-label">INCOME</div>
            {editing ? (
              <input
                className="erd-income-input"
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <button className="erd-income-edit" onClick={() => { setEditValue(String(income)); setEditing(true) }}>
                {formatCurrency(income)}
                <span className="erd-income-edit-icon">✏️</span>
              </button>
            )}
          </div>
          {sparkData && sparkData.length > 0 && (
            <div className="erd-income-spark">
              {sparkData.map((d) => {
                const h = Math.max(2, (d.value / maxSpark) * 20)
                return <i key={d.date} style={{ height: `${h}px` }} title={`${d.date}: ${formatCurrency(d.value)}`} />
              })}
            </div>
          )}
        </div>
        <div className="erd-card-divider" />
        <div className="erd-income-row">
          <span>Assigned</span>
          <strong>{formatCurrency(totalAssigned)}</strong>
        </div>
        <div className="erd-income-row">
          <span>Overspent</span>
          <strong className={overspentCount > 0 ? 'is-neg' : ''}>
            {overspentCount} of {totalEnvelopes}
          </strong>
        </div>
      </section>
    </>
  )
}
