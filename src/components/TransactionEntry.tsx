import { useState, useEffect, useRef } from 'react'
import { addExpense } from '../services/api'
import { suggestCategory, invalidateCategoryCache, getTodayISO } from '../services/autoCategory'
import { SuccessButton, useButtonPhase } from './SuccessButton'

interface Props {
  categories: string[]
  onSaved: () => void
}

export function TransactionEntry({ categories, onSaved }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(getTodayISO())
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'credit_card'>('bank')
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [error, setError] = useState('')
  const itemRef = useRef<HTMLInputElement>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (expanded) itemRef.current?.focus()
  }, [expanded])

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!item.trim()) return
    suggestTimer.current = setTimeout(async () => {
      const suggested = await suggestCategory(item, categories)
      if (suggested) setCategory(suggested)
    }, 300)
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current) }
  }, [item, categories])

  function reset() {
    setItem('')
    setAmount('')
    setCategory('')
    setDate(getTodayISO())
    setNotes('')
    setPaymentMethod('bank')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item.trim() || !amount.trim() || !category) {
      setError('Item, amount, and category required')
      return
    }
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt <= 0) {
      setError('Amount must be a positive number')
      return
    }
    start()
    setError('')
    try {
      await addExpense({
        item: item.trim(),
        amount_inr: String(amt),
        category,
        date,
        notes: notes.trim(),
        payment_method: paymentMethod,
      })
      invalidateCategoryCache()
      onSaved()
      succeed(() => reset())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      fail()
    }
  }

  if (!expanded) {
    return (
      <button type="button" className="txn-entry-trigger action-button" onClick={() => setExpanded(true)}>
        + Log expense
      </button>
    )
  }

  return (
    <form className="txn-entry" onSubmit={handleSubmit}>
      <div className="txn-entry-row">
        <input ref={itemRef} type="text" className="txn-entry-input txn-entry-item" placeholder="Item name"
          value={item} onChange={(e) => setItem(e.target.value)} aria-label="Item" />
        <input type="number" step="any" className="txn-entry-input txn-entry-amount" placeholder="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
        <select className="txn-entry-input txn-entry-cat" value={category}
          onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">Assign to</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="txn-entry-input txn-entry-date" value={date}
          onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <button type="button" className="action-button is-ghost" onClick={() => { reset(); setExpanded(false) }}>
          Cancel
        </button>
        <SuccessButton type="submit" saving={saving} success={success} disabled={saving || success}>
          Save
        </SuccessButton>
      </div>
      <div className="txn-entry-row">
        <input type="text" className="txn-entry-input txn-entry-notes" placeholder="Notes (optional)"
          value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
        <label className="txn-entry-paymethod">
          <span className={`txn-entry-paymethod-opt ${paymentMethod === 'bank' ? 'is-active' : ''}`}
            onClick={() => setPaymentMethod('bank')}>Bank/UPI</span>
          <span className={`txn-entry-paymethod-opt ${paymentMethod === 'credit_card' ? 'is-active' : ''}`}
            onClick={() => setPaymentMethod('credit_card')}>Credit Card</span>
        </label>
      </div>
      {error && <p className="txn-entry-error">{error}</p>}
    </form>
  )
}
