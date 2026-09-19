'use client'

import { useCurrency } from '@/src/context/CurrencyContext'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Scrim, Sheet } from './MotionSheet'
import { DatePicker } from './DatePicker'
import { addExpense } from '../api/expenses'
import { getCategoryMap } from '../api/categoryMap'
import { suggestCategoryLLM } from '../lib/autoCategory'
import { SuccessButton, useButtonPhase } from './SuccessButton'
import { CategoryPicker } from './CategoryPicker'
import { useCategories } from '../hooks/useCategories'
import { EMPTY } from '../lib/constants'

interface Props {
  onClose: () => void
  onSaved: () => void
}

/** Shortest item text worth asking the model about — "T" or "Tr" can't be categorised. */
const MIN_LLM_CHARS = 3

// Model answers per item text, for the page's lifetime. '' (nothing fits) is
// cached too, so retyping or backspacing never re-asks for the same text.
const llmAnswers = new Map<string, string>()

/** Date as a local `YYYY-MM-DD` string (DatePicker's `parseISO` reads it back as a local Date). */
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Today / Yesterday / … as an ISO date, rendered in local time. */
function offsetDateValue(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return toDateInputValue(d)
}

export function LogExpenseModal({ onClose, onSaved }: Props) {
  const { currencySymbol } = useCurrency()

  const categoriesQ = useCategories()
  const categories = useMemo(
    () => (categoriesQ.data ?? EMPTY).map((c) => c.name).filter(Boolean),
    [categoriesQ.data],
  )

  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('')
  const [date, setDate] = useState(toDateInputValue(new Date()))
  const [showCalendar, setShowCalendar] = useState(false)
  const [error, setError] = useState('')
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const [categoryWords, setCategoryWords] = useState<Record<string, string>>({})
  const [categoryTouched, setCategoryTouched] = useState(false)
  const categoryTouchedRef = useRef(categoryTouched)
  const llmDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The item text the latest keystroke produced; a model reply for any other text is stale.
  const latestItemRef = useRef('')
  // No suggestion means nothing selected. Defaulting to the first category
  // silently filed items like "Travel" under whatever category came first.
  const effectiveCategory = category

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

  function applyLlmAnswer(value: string, llmCategory: string) {
    if (categoryTouchedRef.current || latestItemRef.current !== value) return
    if (llmCategory && categories.includes(llmCategory)) {
      setCategory(llmCategory)
      // Mirror the server's word overrides so the same words match locally, instantly, next time.
      const learned = Object.fromEntries(
        value.toLowerCase().split(/\s+/).filter((w) => w.length >= 2).map((w) => [w, llmCategory]),
      )
      setCategoryWords((words) => ({ ...words, ...learned }))
      return
    }
    const misc = categories.find((c) => c.toLowerCase().includes('miscellaneous'))
    setCategory(misc ?? '')
  }

  function handleItemChange(value: string) {
    setItem(value)
    latestItemRef.current = value
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
    const key = value.trim().toLowerCase()
    if (key.length < MIN_LLM_CHARS) return
    const known = llmAnswers.get(key)
    if (known !== undefined) {
      applyLlmAnswer(value, known)
      return
    }

    // No local match — debounce an LLM fallback lookup instead of firing per keystroke.
    llmDebounceRef.current = setTimeout(() => {
      suggestCategoryLLM(value, categories).then((llmCategory) => {
        if (llmCategory !== null) llmAnswers.set(key, llmCategory)
        applyLlmAnswer(value, llmCategory ?? '')
      })
    }, 200)
  }

  function handleAmountChange(value: string) {
    // Numbers only, one decimal separator — an invalid keystroke is dropped outright.
    if (/[^0-9.]/.test(value)) return
    setAmount(value)
  }

  function handleCategoryPick(c: string) {
    setCategory(c)
    setCategoryTouched(true)
  }

  function handleDatePick(value: string) {
    setDate(value)
    setShowCalendar(false)
  }

  function closeAndReset() {
    setItem('')
    setAmount('')
    setCategory('')
    setDate(toDateInputValue(new Date()))
    setShowCalendar(false)
    setCategoryTouched(false)
    onClose()
  }

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!item.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setError('Fill in item and amount.')
      return
    }

    if (!effectiveCategory) {
      setError('Pick a category.')
      return
    }
    start()
    setError('')
    try {
      await addExpense({
        item: item.trim(),
        amount_inr: String(Math.round(parsed)),
        category: effectiveCategory,
        date: date || undefined,
      })
      onSaved()
      succeed(closeAndReset)
    } catch {
      setError('Could not save — try again.')
      fail()
    }
  }

  const today = offsetDateValue(0)
  const yesterday = offsetDateValue(1)

  return (
    <Scrim className="erd-modal-overlay" onClick={success ? undefined : onClose}>
      <Sheet className="erd-modal-card erd-log-card" onClick={(e) => e.stopPropagation()}>
        <div className="erd-modal-head">
          <h3>Log expense</h3>
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

        <div className="erd-log-body">
          <section className="erd-log-section">
            <label className="erd-log-label" htmlFor="erd-log-amount">
              Amount
            </label>
            <div className="erd-amount-field">
              <span className="erd-amount-symbol" aria-hidden="true">
                {currencySymbol}
              </span>
              <input
                id="erd-log-amount"
                className="erd-amount-input"
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder="0"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
              />
            </div>
          </section>

          <section className="erd-log-section">
            <label className="erd-log-label" htmlFor="erd-log-item">
              What was it for?
            </label>
            <input
              id="erd-log-item"
              className="erd-log-input"
              placeholder="e.g. Bike repair"
              value={item}
              onChange={(e) => handleItemChange(e.target.value)}
            />
          </section>

          <section className="erd-log-section">
            <div className="erd-log-label">Category</div>
            <CategoryPicker value={effectiveCategory} onChange={handleCategoryPick} />
          </section>

          <section className="erd-log-section">
            <div className="erd-log-label">Date</div>
            <div className="erd-date-row" role="group" aria-label="Date">
              <button
                type="button"
                className={`erd-date-chip${date === today ? ' is-active' : ''}`}
                onClick={() => handleDatePick(today)}
              >
                Today
              </button>
              <button
                type="button"
                className={`erd-date-chip${date === yesterday ? ' is-active' : ''}`}
                onClick={() => handleDatePick(yesterday)}
              >
                Yesterday
              </button>
              <button
                type="button"
                className={`erd-date-chip${showCalendar ? ' is-active' : ''}`}
                onClick={() => setShowCalendar((v) => !v)}
              >
                <Calendar size={15} aria-hidden="true" />
                {showCalendar ? 'Close' : 'Pick date'}
              </button>
            </div>
            {showCalendar && (
              <DatePicker mode="single" value={date} onChange={handleDatePick} />
            )}
          </section>

          {error && <p className="erd-log-error">{error}</p>}
        </div>

        <div className="erd-log-footer">
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
        </div>
      </Sheet>
    </Scrim>
  )
}