'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Scrim, Sheet } from './MotionSheet'
import { addExpense } from '../services/api'

interface Props {
  onClose: () => void
  onSaved: () => void
  categories: string[]
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function LogExpenseModal({ onClose, onSaved, categories }: Props) {
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(categories[0] ?? '')
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [logSuccess, setLogSuccess] = useState(false)

  const chips = useMemo(
    () => Array.from(new Set(categories.filter(Boolean))),
    [categories],
  )

  function closeAndReset() {
    setItem('')
    setAmount('')
    setCategory(categories[0] ?? '')
    setDate(toDateInputValue(new Date()))
    setLogSuccess(false)
    onClose()
  }

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!item.trim() || Number.isNaN(parsed) || parsed <= 0 || !category) {
      setError('Fill in item, amount, and pick a category.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addExpense({
        item: item.trim(),
        amount_inr: String(Math.round(parsed)),
        category,
        date: date || undefined,
      })
      onSaved()
      setSaving(false)
      setLogSuccess(true)
      setTimeout(closeAndReset, 1100)
    } catch {
      setError('Could not save — try again.')
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      <Scrim className="erd-modal-overlay" onClick={logSuccess ? undefined : onClose}>
        <Sheet className="erd-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="erd-modal-head">
            <h3>Log Expense</h3>
            <button
              type="button"
              className="erd-modal-close"
              onClick={onClose}
              aria-label="Close"
              disabled={logSuccess}
            >
              ✕
            </button>
          </div>

          <label className="erd-log-label" htmlFor="erd-log-item">
            What did you buy?
          </label>
          <input
            id="erd-log-item"
            className="erd-log-input"
            placeholder="e.g. Momo at the corner"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          />

          <label className="erd-log-label" htmlFor="erd-log-amount">
            Amount (₹)
          </label>
          <input
            id="erd-log-amount"
            className="erd-log-input"
            type="number"
            min={1}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="erd-log-label">Category</div>
          <div className="erd-chip-row">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className={`erd-chip ${category === c ? 'is-selected' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="erd-log-label" htmlFor="erd-log-date">
            Date
          </label>
          <input
            id="erd-log-date"
            className="erd-log-input"
            type="date"
            value={date}
            max={toDateInputValue(new Date())}
            onChange={(e) => setDate(e.target.value)}
          />

          {error && <p className="erd-log-error">{error}</p>}

          {logSuccess ? (
            <div className="erd-log-success" aria-live="polite" aria-label="Expense saved">
              <svg className="erd-log-success-check" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                />
              </svg>
            </div>
          ) : (
            <button
              type="button"
              className="erd-log-submit"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? 'Saving…' : 'Save expense'}
            </button>
          )}
        </Sheet>
      </Scrim>
    </AnimatePresence>
  )
}
