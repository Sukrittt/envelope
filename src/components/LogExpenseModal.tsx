'use client'

import { useCurrency } from '@/src/context/CurrencyContext'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
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
    }, 300)
  }

  function handleCategoryPick(c: string) {
    setCategory(c)
    setCategoryTouched(true)
  }

  function closeAndReset() {
    setItem('')
    setAmount('')
    setCategory('')
    setDate(toDateInputValue(new Date()))
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

          Amount ({currencySymbol})
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
        <CategoryPicker value={effectiveCategory} onChange={handleCategoryPick} />

        <label className="erd-log-label">Date</label>
        <DatePicker mode="single" value={date} onChange={setDate} />

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
