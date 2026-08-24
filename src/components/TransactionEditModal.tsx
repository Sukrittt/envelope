import { useState } from 'react'
import { updateExpense } from '../services/api'
import { Scrim, Sheet } from './MotionSheet'
import { SuccessButton, useButtonPhase } from './SuccessButton'

interface Props {
  id?: string
  timestamp: string
  item: string
  amountInr: number
  date: string
  category: string
  categories: string[]
  onClose: () => void
  onSaved: () => void
}

export function TransactionEditModal({
  id,
  timestamp,
  item: initialItem,
  amountInr,
  date: initialDate,
  category: initialCategory,
  categories,
  onClose,
  onSaved,
}: Props) {
  const [item, setItem] = useState(initialItem)
  const [amount, setAmount] = useState(String(amountInr))
  const [date, setDate] = useState(initialDate.slice(0, 10))
  const [category, setCategory] = useState(initialCategory)
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [error, setError] = useState('')

  const amt = parseFloat(amount)
  const canSave = item.trim() !== '' && !Number.isNaN(amt) && amt >= 0 && date.trim() !== ''

  async function handleSave() {
    if (!canSave || saving || success) return
    setError('')
    start()
    try {
      await updateExpense(id, timestamp, initialItem, amountInr, {
        new_item: item.trim(),
        new_amount_inr: String(amt),
        new_date: date,
        category,
      })
      onSaved()
      succeed(onClose)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction')
      fail()
    }
  }

  return (
    <Scrim
      className="category-manager-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <Sheet className="category-manager subscription-modal">
        <div className="category-manager-header">
          <h3>Edit transaction</h3>
          <button type="button" className="action-button is-ghost" onClick={onClose} aria-label="Close" disabled={success}>
            ✕
          </button>
        </div>

        {error && <p className="txn-entry-error">{error}</p>}

        <div className="category-manager-body">
          <div className="subscription-modal-form">
            <label className="subscription-modal-field">
              <span>Description</span>
              <input
                type="text"
                className="txn-entry-input"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="What was this for?"
                autoFocus
              />
            </label>

            <label className="subscription-modal-field">
              <span>Amount (₹)</span>
              <input
                type="number"
                step="any"
                min="0"
                className="txn-entry-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>

            <label className="subscription-modal-field">
              <span>Date</span>
              <input
                type="date"
                className="txn-entry-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label className="subscription-modal-field">
              <span>Category</span>
              <select
                className="txn-entry-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="subscription-modal-actions">
          <button type="button" className="action-button is-ghost" onClick={onClose} disabled={success}>
            Cancel
          </button>
          <SuccessButton
            type="button"
            disabled={!canSave || saving || success}
            saving={saving}
            success={success}
            onClick={handleSave}
          >
            Save changes
          </SuccessButton>
        </div>
      </Sheet>
    </Scrim>
  )
}
