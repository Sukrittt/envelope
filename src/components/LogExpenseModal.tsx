'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Scrim, Sheet } from './MotionSheet'
import { DatePicker } from './DatePicker'
import { addExpense } from '../api/expenses'
import { getCategoryMap } from '../api/categoryMap'
import { suggestCategoryLLM } from '../lib/autoCategory'
import { SuccessButton, useButtonPhase } from './SuccessButton'
import { CategoryPicker } from './CategoryPicker'
import { SplitExpenseEditor, makeSplitLine, type SplitLine } from './SplitExpenseEditor'
import { useCategories } from '../hooks/useCategories'
import { EMPTY } from '../lib/constants'

interface Props {
  onClose: () => void
  onSaved: () => void
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function LogExpenseModal({ onClose, onSaved }: Props) {
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
  const [isSplit, setIsSplit] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() => [makeSplitLine()])
  // Categories load async, after this component's first render — fall back
  // to the first one instead of syncing it into state once it arrives.
  const effectiveCategory = category || categories[0] || ''

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
    setCategory('')
    setDate(toDateInputValue(new Date()))
    setCategoryTouched(false)
    setIsSplit(false)
    setSplitLines([makeSplitLine()])
    onClose()
  }

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!item.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setError('Fill in item and amount.')
      return
    }

    if (isSplit) {
      const validLines = splitLines.filter((l) => l.category && Number(l.amount) > 0)
      const allocated = validLines.reduce((s, l) => s + Number(l.amount), 0)
      if (validLines.length < 2 || Math.abs(allocated - parsed) >= 0.01) {
        setError('Split lines must add up to the total amount.')
        return
      }
      start()
      setError('')
      try {
        for (let i = 0; i < validLines.length; i++) {
          const line = validLines[i]
          await addExpense({
            item: item.trim(),
            amount_inr: String(line.amount),
            category: line.category,
            date: date || undefined,
            notes: `Split ${i + 1}/${validLines.length} of ${amount}`,
          })
        }
        onSaved()
        succeed(closeAndReset)
      } catch {
        setError('Could not save — try again.')
        fail()
      }
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

        <label className="erd-split-toggle">
          <input
            type="checkbox"
            checked={isSplit}
            onChange={(e) => setIsSplit(e.target.checked)}
          />
          Split this expense across categories
        </label>

        {isSplit ? (
          <SplitExpenseEditor total={Number(amount) || 0} lines={splitLines} onChange={setSplitLines} />
        ) : (
          <>
            <div className="erd-log-label">Category</div>
            <CategoryPicker value={effectiveCategory} onChange={handleCategoryPick} />
          </>
        )}

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
