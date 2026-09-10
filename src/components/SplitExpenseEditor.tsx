'use client'

import { feeDiff } from '../lib/split'
import { formatCurrency } from '@/lib/currency'
import { CategoryPicker } from './CategoryPicker'

export type SplitLine = { id: string; category: string; amount: string }

let nextLineId = 0
export function makeSplitLine(category = '', amount = ''): SplitLine {
  nextLineId += 1
  return { id: String(nextLineId), category, amount }
}

interface Props {
  total: number
  lines: SplitLine[]
  onChange: (lines: SplitLine[]) => void
}

/**
 * Divides one expense's amount across multiple categories. Manual only — no
 * scanning involved, that's scan-bill's job (a separate feature). Reuses
 * split.ts's feeDiff purely for the "amount left to allocate" math.
 */
export function SplitExpenseEditor({ total, lines, onChange }: Props) {
  const remaining = feeDiff(total, lines.map((l) => ({ price: Number(l.amount) || 0 })))
  const isBalanced = Math.abs(remaining) < 0.01

  function updateLine(id: string, patch: Partial<SplitLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id))
  }

  function addLine() {
    onChange([...lines, makeSplitLine()])
  }

  return (
    <div className="split-expense-editor">
      {lines.map((line, i) => (
        <div key={line.id} className="split-expense-line">
          <div className="split-expense-line-head">
            <input
              type="number"
              className="erd-log-input split-expense-amount"
              placeholder="0"
              value={line.amount}
              onChange={(e) => updateLine(line.id, { amount: e.target.value })}
            />
            {lines.length > 1 && (
              <button
                type="button"
                className="split-expense-remove"
                onClick={() => removeLine(line.id)}
                aria-label={`Remove line ${i + 1}`}
              >
                ✕
              </button>
            )}
          </div>
          <CategoryPicker value={line.category} onChange={(c) => updateLine(line.id, { category: c })} />
        </div>
      ))}
      <button type="button" className="action-button is-ghost split-expense-add" onClick={addLine}>
        + Add category
      </button>
      <p className={`split-expense-summary ${isBalanced ? 'is-balanced' : ''}`}>
        {isBalanced
          ? 'Fully allocated'
          : remaining > 0
            ? `${formatCurrency(remaining)} left to allocate`
            : `Over by ${formatCurrency(Math.abs(remaining))}`}
      </p>
    </div>
  )
}
