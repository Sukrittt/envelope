import { useState } from 'react'
import { updateExpense, addExpense, deleteExpense } from '../api/expenses'
import { Scrim, Sheet } from './MotionSheet'
import { SuccessButton, useButtonPhase } from './SuccessButton'
import { DatePicker } from './DatePicker'
import { CategoryPicker } from './CategoryPicker'
import { SplitExpenseEditor, makeSplitLine, type SplitLine } from './SplitExpenseEditor'

interface Props {
  id?: string
  timestamp: string
  item: string
  amountInr: number
  date: string
  category: string
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
  onClose,
  onSaved,
}: Props) {
  const [item, setItem] = useState(initialItem)
  const [amount, setAmount] = useState(String(amountInr))
  const [date, setDate] = useState(initialDate.slice(0, 10))
  const [category, setCategory] = useState(initialCategory)
  const [isSplit, setIsSplit] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() => [
    makeSplitLine(initialCategory, String(amountInr)),
  ])
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [error, setError] = useState('')

  const amt = parseFloat(amount)
  const canSave = isSplit
    ? item.trim() !== '' && date.trim() !== ''
    : item.trim() !== '' && !Number.isNaN(amt) && amt >= 0 && date.trim() !== '' && category !== ''

  async function handleSave() {
    if (!canSave || saving || success) return
    setError('')

    if (isSplit) {
      const validLines = splitLines.filter((l) => l.category && Number(l.amount) > 0)
      const allocated = validLines.reduce((s, l) => s + Number(l.amount), 0)
      if (validLines.length < 2 || Math.abs(allocated - amt) >= 0.01) {
        setError('Split lines must add up to the total amount.')
        return
      }
      start()
      try {
        await deleteExpense(id, timestamp, initialItem, amountInr)
        for (let i = 0; i < validLines.length; i++) {
          const line = validLines[i]
          await addExpense({
            item: item.trim(),
            amount_inr: String(line.amount),
            category: line.category,
            date,
            notes: `Split ${i + 1}/${validLines.length} of ${amount}`,
          })
        }
        onSaved()
        succeed(onClose)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update transaction')
        fail()
      }
      return
    }

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
                disabled={isSplit}
              />
            </label>

            <label className="subscription-modal-field">
              <span>Date</span>
              <DatePicker mode="single" value={date} onChange={setDate} />
            </label>

            <label className="erd-split-toggle">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => setIsSplit(e.target.checked)}
              />
              Split this expense across categories
            </label>

            {isSplit ? (
              <SplitExpenseEditor total={amt || 0} lines={splitLines} onChange={setSplitLines} />
            ) : (
              <label className="subscription-modal-field">
                <span>Category</span>
                <CategoryPicker value={category} onChange={setCategory} />
              </label>
            )}
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
