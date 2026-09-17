'use client'

import { useState } from 'react'
import { useCurrency } from '@/src/context/CurrencyContext'

import { feeDiff, round2 } from '../lib/split'
import { CHART_COLORS } from '../theme/chartColors'

import { CategoryPicker } from './CategoryPicker'

export type SplitLine = { id: string; category: string; amount: string }

let nextLineId = 0
export function makeSplitLine(category = '', amount = ''): SplitLine {
  nextLineId += 1
  return { id: String(nextLineId), category, amount }
}

type SplitMode = 'amount' | 'percent'

interface Props {
  total: number
  lines: SplitLine[]
  onChange: (lines: SplitLine[]) => void
}

/**
 * Divides one expense's amount across multiple categories, by amount or by
 * percentage of the total — `amount` on SplitLine stays the source of truth
 * either way, percent mode just displays/edits it as a share of `total`.
 * Manual only — no scanning involved, that's scan-bill's job (a separate
 * feature). Reuses split.ts's feeDiff/round2 for the allocation math.
 */
export function SplitExpenseEditor({ total, lines, onChange }: Props) {
  const { formatCurrency } = useCurrency()
  const [mode, setMode] = useState<SplitMode>('amount')

  const remaining = feeDiff(total, lines.map((l) => ({ price: Number(l.amount) || 0 })))
  const isBalanced = Math.abs(remaining) < 0.01

  function updateLine(id: string, patch: Partial<SplitLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function updatePercent(id: string, pctInput: string) {
    if (pctInput === '') {
      updateLine(id, { amount: '' })
      return
    }
    const pct = Number(pctInput)
    if (Number.isNaN(pct)) return
    updateLine(id, { amount: total > 0 ? String(round2((total * pct) / 100)) : '' })
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id))
  }

  function addLine() {
    onChange([...lines, makeSplitLine()])
  }

  return (
    <div className="split-expense-editor">
      <div className="account-segmented split-mode-toggle" role="tablist" aria-label="Split by">
        <button type="button" role="tab" aria-selected={mode === 'amount'} className={mode === 'amount' ? 'is-active' : ''} onClick={() => setMode('amount')}>
          By amount
        </button>
        <button type="button" role="tab" aria-selected={mode === 'percent'} className={mode === 'percent' ? 'is-active' : ''} onClick={() => setMode('percent')}>
          By percentage
        </button>
      </div>

      {total > 0 && <SplitVisualization total={total} lines={lines} formatCurrency={formatCurrency} />}

      {lines.map((line, i) => {
        const pct = total > 0 ? round2(((Number(line.amount) || 0) / total) * 100) : 0
        return (
          <div key={line.id} className="split-expense-line">
            <div className="split-expense-line-head">
              {mode === 'amount' ? (
                <input
                  type="number"
                  className="erd-log-input split-expense-amount"
                  placeholder="0"
                  value={line.amount}
                  onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                />
              ) : (
                <div className="split-expense-percent-input">
                  <input
                    type="number"
                    className="erd-log-input split-expense-amount"
                    placeholder="0"
                    min={0}
                    max={100}
                    value={line.amount ? pct : ''}
                    onChange={(e) => updatePercent(line.id, e.target.value)}
                  />
                  <span className="split-expense-percent-sign">%</span>
                </div>
              )}
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
            {line.amount && (
              <p className="split-expense-line-hint">
                {mode === 'amount' ? `${pct}% of total` : formatCurrency(Number(line.amount))}
              </p>
            )}
          </div>
        )
      })}
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

/** Stacked bar + legend showing how `total` currently divides across `lines`, with any unallocated remainder shown as a gap. */
function SplitVisualization({
  total,
  lines,
  formatCurrency,
}: {
  total: number
  lines: SplitLine[]
  formatCurrency: (n: number) => string
}) {
  const segments = lines
    .map((line, i) => ({ ...line, value: Number(line.amount) || 0, color: CHART_COLORS[i % CHART_COLORS.length] }))
    .filter((line) => line.value > 0)
  const allocated = segments.reduce((sum, line) => sum + line.value, 0)
  const unallocatedPct = total > 0 ? Math.max(0, round2(((total - allocated) / total) * 100)) : 0

  if (segments.length === 0) return null

  return (
    <div className="split-visualization">
      <div className="split-viz-bar">
        {segments.map((line) => (
          <div
            key={line.id}
            className="split-viz-segment"
            style={{ width: `${Math.min(100, round2((line.value / total) * 100))}%`, background: line.color }}
          />
        ))}
        {unallocatedPct > 0 && (
          <div className="split-viz-segment split-viz-segment-empty" style={{ width: `${unallocatedPct}%` }} />
        )}
      </div>
      <div className="split-viz-legend">
        {segments.map((line) => (
          <div key={line.id} className="split-viz-legend-item">
            <span className="split-viz-swatch" style={{ background: line.color }} />
            <span className="split-viz-legend-label">{line.category || 'Uncategorized'}</span>
            <span className="split-viz-legend-value">
              {formatCurrency(line.value)} · {round2((line.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
