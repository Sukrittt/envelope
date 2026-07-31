import { useState } from 'react'

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

function formatCurrency(value: number): string {
  const rounded = Math.round(value)
  return `₹${(rounded === 0 ? 0 : rounded).toLocaleString('en-IN')}`
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

  const rtaClass = isOverAssigned ? 'rta-negative' : readyToAssign === 0 ? 'rta-zero' : 'rta-positive'

  const maxSpark = sparkData && sparkData.length > 0
    ? Math.max(...sparkData.map((d) => d.value), 1)
    : 1

  return (
    <div className={`rta-banner ${rtaClass}`}>
      <div className="rta-main">
        <div className="rta-text-block">
          <span className="rta-label">Ready to Assign</span>
          <span className="rta-amount">{formatCurrency(readyToAssign)}</span>
          {isOverAssigned && (
            <span className="rta-warning">Over-assigned — reduce category budgets</span>
          )}
          {!isOverAssigned && readyToAssign === 0 && (
            <span className="rta-ok">Every rupee has a job</span>
          )}
        </div>
        {sparkData && sparkData.length > 0 && (
          <div className="rta-spark">
            {sparkData.map((d) => {
              const h = Math.max(2, (d.value / maxSpark) * 20)
              return (
                <div
                  key={d.date}
                  className="rta-spark-bar"
                  style={{ height: `${h}px` }}
                  title={`${d.date}: ${formatCurrency(d.value)}`}
                />
              )
            })}
          </div>
        )}
      </div>
      <div className="rta-breakdown">
        <div className="rta-item">
          <span className="rta-item-label">Income</span>
          {editing ? (
            <input
              className="rta-income-input"
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <button className="rta-income-value" onClick={() => { setEditValue(String(income)); setEditing(true) }}>
              {formatCurrency(income)}
              <span className="rta-edit-icon">✏️</span>
            </button>
          )}
        </div>
        <div className="rta-item">
          <span className="rta-item-label">Assigned</span>
          <span className="rta-item-value">{formatCurrency(totalAssigned)}</span>
        </div>
        <div className="rta-item">
          <span className="rta-item-label">Overspent</span>
          <span className={`rta-item-value ${overspentCount > 0 ? 'rta-negative' : ''}`}>
            {overspentCount} of {totalEnvelopes}
          </span>
        </div>
      </div>
    </div>
  )
}
