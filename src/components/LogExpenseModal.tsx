'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Scrim, Sheet } from './MotionSheet'
import { addExpense, getCategoryMap } from '../services/api'
import { suggestCategoryLLM } from '../services/autoCategory'
import { SuccessButton, useButtonPhase } from './SuccessButton'

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
  const [error, setError] = useState('')
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [categoryWords, setCategoryWords] = useState<Record<string, string>>({})
  const [categoryTouched, setCategoryTouched] = useState(false)
  const categoryTouchedRef = useRef(categoryTouched)
  const llmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getCategoryMap()
      .then((map) => setCategoryWords(map.words))
      .catch(() => {})
  }, [])

  useEffect(() => {
    categoryTouchedRef.current = categoryTouched
  }, [categoryTouched])

  // Cancel any pending debounced LLM lookup on unmount.
  useEffect(() => {
    return () => {
      if (llmDebounceRef.current) clearTimeout(llmDebounceRef.current)
    }
  }, [])

  const chips = useMemo(
    () => Array.from(new Set(categories.filter(Boolean))),
    [categories],
  )

  function handleItemChange(value: string) {
    setItem(value)
    if (llmDebounceRef.current) {
      clearTimeout(llmDebounceRef.current)
      llmDebounceRef.current = null
    }
    if (categoryTouched) return
    const words = value.toLowerCase().split(/\s+/)
    for (const word of words) {
      const match = categoryWords[word]
      if (!match) continue
      const live = categories.includes(match)
        ? match
        : categories.find((c) => c.toLowerCase().includes(match.toLowerCase()))
      if (live) {
        setCategory(live)
        return
      }
    }
    if (!value.trim()) return

    // No local match — debounce an LLM fallback lookup instead of firing per keystroke.
    llmDebounceRef.current = setTimeout(() => {
      suggestCategoryLLM(value, categories).then((llmCategory) => {
        if (categoryTouchedRef.current) return
        if (llmCategory) {
          setCategory(llmCategory)
          return
        }
        const misc = categories.find((c) => c.toLowerCase().includes('miscellaneous'))
        if (misc) setCategory(misc)
      })
    }, 300)
  }

  function handleCategoryPick(c: string) {
    setCategory(c)
    setCategoryTouched(true)
  }

  function closeAndReset() {
    setItem('')
    setAmount('')
    setCategory(categories[0] ?? '')
    setDate(toDateInputValue(new Date()))
    setCategoryTouched(false)
    onClose()
  }

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!item.trim() || Number.isNaN(parsed) || parsed <= 0 || !category) {
      setError('Fill in item, amount, and pick a category.')
      return
    }
    start()
    setError('')
    try {
      await addExpense({
        item: item.trim(),
        amount_inr: String(Math.round(parsed)),
        category,
        date: date || undefined,
      })
      onSaved()
      succeed(closeAndReset)
    } catch {
      setError('Could not save — try again.')
      fail()
    }
  }

  return (
    <Scrim className="erd-modal-overlay" onClick={success ? undefined : onClose}>
      <Sheet className="erd-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="erd-modal-head">
          <h3>Log Expense</h3>
          <button
            type="button"
            className="erd-modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={success}
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
          onChange={(e) => handleItemChange(e.target.value)}
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
              onClick={() => handleCategoryPick(c)}
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

        <SuccessButton
          type="button"
          baseClass="erd-log-submit"
          saving={saving}
          success={success}
          successLabel="Expense saved"
          disabled={saving || success}
          onClick={handleSubmit}
        >
          Save expense
        </SuccessButton>
      </Sheet>
    </Scrim>
  )
}
