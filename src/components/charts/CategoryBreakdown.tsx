'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ListFilter, TrendingDown, TrendingUp, X } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { BreakdownRow, MonthComparison } from '@/src/lib/monthly'
import { CHART_COLORS } from '@/src/theme/chartColors'
import { AllocationBar } from './AllocationBar'
import { DonutChart, type DonutSegment } from './DonutChart'

interface Props {
  rows: BreakdownRow[]
  mode: 'category' | 'group'
  onModeChange: (mode: 'category' | 'group') => void
  selectedKey: string | null
  onSelectKey: (key: string | null) => void
  comparison: MonthComparison | null
  leftover: number
  monthLabel: string
  hideAmounts?: boolean
}

const VISIBLE_ROWS = 6
const DONUT_TAIL_PCT = 3

function money(value: number, hidden: boolean) {
  return hidden ? '₹••••' : formatCurrency(value)
}

function buildSegments(rows: BreakdownRow[], colors: Map<string, string>): DonutSegment[] {
  const big = rows.filter((row) => row.pct >= DONUT_TAIL_PCT)
  const small = rows.filter((row) => row.pct < DONUT_TAIL_PCT)
  const segments = big.map((row) => ({
    key: row.key,
    label: row.label,
    emoji: row.emoji,
    value: row.spent,
    color: colors.get(row.key) ?? 'var(--erd-text3)',
  }))
  if (small.length > 0) {
    segments.push({
      key: '__other__',
      label: 'Other',
      emoji: '',
      value: small.reduce((sum, row) => sum + row.spent, 0),
      color: 'var(--erd-text3)',
    })
  }
  return segments
}

export function CategoryBreakdown({
  rows,
  mode,
  onModeChange,
  selectedKey,
  onSelectKey,
  comparison,
  leftover,
  monthLabel,
  hideAmounts = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'spend' | 'budget'>('spend')
  const [filterOpen, setFilterOpen] = useState(false)
  const [included, setIncluded] = useState<Set<string> | null>(null)
  const [draftIncluded, setDraftIncluded] = useState<Set<string>>(new Set())

  const displayRows = useMemo(() => {
    const filtered = included == null ? rows : rows.filter((row) => included.has(row.key))
    const total = filtered.reduce((sum, row) => sum + row.spent, 0) || 1
    return filtered.map((row) => ({ ...row, pct: (row.spent / total) * 100 }))
  }, [included, rows])

  const colors = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((row, index) => map.set(row.key, CHART_COLORS[index % CHART_COLORS.length]))
    return map
  }, [rows])

  const segments = useMemo(() => buildSegments(displayRows, colors), [displayRows, colors])
  const sortedRows = useMemo(() => {
    if (sortBy === 'spend') return displayRows
    return [...displayRows].sort((a, b) => {
      const aRatio = !a.assignedIsCarried && a.assigned > 0 ? a.spent / a.assigned : -1
      const bRatio = !b.assignedIsCarried && b.assigned > 0 ? b.spent / b.assigned : -1
      return bRatio - aRatio
    })
  }, [displayRows, sortBy])

  const visibleRows = expanded ? sortedRows : sortedRows.slice(0, VISIBLE_ROWS)
  const selectedRow = displayRows.find((row) => row.key === selectedKey) ?? null
  const filtered = included != null && included.size !== rows.length
  const selectedDonutKey = selectedKey && segments.some((segment) => segment.key === selectedKey) ? selectedKey : selectedKey ? '__other__' : null
  const total = displayRows.reduce((sum, row) => sum + row.spent, 0)

  function openFilter() {
    setDraftIncluded(new Set(included ?? rows.map((row) => row.key)))
    setFilterOpen(true)
  }

  function applyFilter() {
    if (draftIncluded.size === 0) return
    setIncluded(draftIncluded.size === rows.length ? null : new Set(draftIncluded))
    if (selectedKey && !draftIncluded.has(selectedKey)) onSelectKey(null)
    setFilterOpen(false)
  }

  return (
    <>
      <div className="ins-card-heading">
        <div>
          <h2>Where it went</h2>
          <p>Your month, split into the parts that shaped it</p>
        </div>
        {rows.length > 1 && (
          <button type="button" className={filtered ? 'ins-icon-btn is-active' : 'ins-icon-btn'} onClick={openFilter} aria-label={filtered ? `Filter chart, ${displayRows.length} active` : 'Filter chart'}>
            <ListFilter size={17} />
            {filtered && <span>{displayRows.length}</span>}
          </button>
        )}
      </div>

      <div className="ins-breakdown-controls">
        <div className="ins-segmented" role="tablist" aria-label="Breakdown type">
          <button type="button" role="tab" aria-selected={mode === 'category'} className={mode === 'category' ? 'is-active' : ''} onClick={() => onModeChange('category')}>By category</button>
          <button type="button" role="tab" aria-selected={mode === 'group'} className={mode === 'group' ? 'is-active' : ''} onClick={() => onModeChange('group')}>By group</button>
        </div>
        <div className="ins-segmented ins-measure" aria-label="Sort breakdown">
          <button type="button" className={sortBy === 'spend' ? 'is-active' : ''} onClick={() => setSortBy('spend')} aria-label="Measure by amount spent">₹</button>
          <button type="button" className={sortBy === 'budget' ? 'is-active' : ''} onClick={() => setSortBy('budget')} aria-label="Measure by percent of budget used">%</button>
        </div>
      </div>

      {displayRows.length === 0 ? (
        <div className="ins-chart-empty">No spending in {monthLabel}</div>
      ) : (
        <>
          <div className="ins-breakdown-visuals">
            <DonutChart segments={segments} selectedKey={selectedDonutKey} onSelect={(key) => onSelectKey(key === '__other__' ? null : key)}>
              {selectedRow ? (
                <>
                  {selectedRow.emoji && <span className="ins-center-emoji">{selectedRow.emoji}</span>}
                  <strong>{money(selectedRow.spent, hideAmounts)}</strong>
                  <span>{selectedRow.pct.toFixed(0)}%</span>
                </>
              ) : filtered ? (
                <>
                  <span>Filtered total</span>
                  <strong>{money(total, hideAmounts)}</strong>
                </>
              ) : comparison?.baseline != null && comparison.deltaPct != null ? (
                <>
                  <span className={comparison.deltaPct > 0 ? 'is-up' : 'is-down'}>
                    {comparison.deltaPct > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(comparison.deltaPct).toFixed(0)}%
                  </span>
                  <small>{money(Math.abs(comparison.spent - comparison.baseline), hideAmounts)} {comparison.deltaPct > 0 ? 'more' : 'less'} than usual</small>
                </>
              ) : (
                <>
                  <span>Top spend</span>
                  <strong>{displayRows[0]?.label}</strong>
                  <small>{displayRows[0]?.pct.toFixed(0)}% of the month</small>
                </>
              )}
            </DonutChart>

            <div className="ins-allocation-panel">
              <span className="ins-kicker">Spend mix</span>
              <AllocationBar segments={segments.map((segment) => ({ label: segment.label, value: segment.value, color: segment.color }))} />
            </div>
          </div>

          <div className="ins-breakdown-list">
            {visibleRows.map((row) => {
              const selected = selectedKey === row.key
              const hasBudget = !row.assignedIsCarried && row.assigned > 0
              const pct = hasBudget ? (row.spent / row.assigned) * 100 : 0
              return (
                <button
                  type="button"
                  key={row.key}
                  className={selected ? 'ins-breakdown-row is-selected' : 'ins-breakdown-row'}
                  onClick={() => onSelectKey(selected ? null : row.key)}
                  aria-pressed={selected}
                >
                  <span className="ins-row-top">
                    <i style={{ background: colors.get(row.key) }} />
                    {row.emoji && <span aria-hidden="true">{row.emoji}</span>}
                    <span className="ins-row-name">{row.label}</span>
                    <strong>{money(row.spent, hideAmounts)}</strong>
                    {row.deltaPct != null && (
                      <span className={row.deltaPct > 0 ? 'ins-delta is-up' : 'ins-delta is-down'}>
                        {row.deltaPct > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(row.deltaPct).toFixed(0)}%
                      </span>
                    )}
                  </span>
                  <span className="ins-budget-track"><i style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'var(--coral)' : colors.get(row.key) }} /></span>
                  <small>{hasBudget ? `${money(row.spent, hideAmounts)} of ${money(row.assigned, hideAmounts)}` : 'No budget set'}</small>
                  {selected && mode === 'category' && <Link href={`/expense/transactions?category=${encodeURIComponent(row.key)}`} onClick={(event) => event.stopPropagation()}>View transactions ›</Link>}
                </button>
              )
            })}
          </div>
          {!expanded && sortedRows.length > VISIBLE_ROWS && (
            <button type="button" className="ins-text-btn" onClick={() => setExpanded(true)}>Other ({sortedRows.length - VISIBLE_ROWS})</button>
          )}
        </>
      )}

      <div className="ins-leftover">
        <span>Income left in {monthLabel}</span>
        <strong>{money(leftover, hideAmounts)}</strong>
      </div>

      {filterOpen && (
        <div className="ins-filter-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFilterOpen(false)}>
          <section className="ins-filter-dialog" role="dialog" aria-modal="true" aria-labelledby="ins-filter-title">
            <div className="ins-filter-head">
              <div><h3 id="ins-filter-title">Filter chart</h3><p>Choose what appears in this chart</p></div>
              <button type="button" className="ins-icon-btn" onClick={() => setFilterOpen(false)} aria-label="Close filter"><X size={18} /></button>
            </div>
            <button type="button" className="ins-text-btn" onClick={() => setDraftIncluded(draftIncluded.size === rows.length ? new Set() : new Set(rows.map((row) => row.key)))}>
              {draftIncluded.size === rows.length ? 'Deselect all' : 'Select all'}
            </button>
            <div className="ins-filter-list">
              {rows.map((row) => {
                const checked = draftIncluded.has(row.key)
                return (
                  <label key={row.key}>
                    <input type="checkbox" checked={checked} onChange={() => setDraftIncluded((current) => {
                      const next = new Set(current)
                      if (next.has(row.key)) next.delete(row.key)
                      else next.add(row.key)
                      return next
                    })} />
                    <span className={checked ? 'ins-check is-checked' : 'ins-check'}>{checked && <Check size={13} />}</span>
                    <span>{row.emoji} {row.label}</span>
                    <strong>{row.pct.toFixed(1)}%</strong>
                  </label>
                )
              })}
            </div>
            {draftIncluded.size === 0 && <p className="ins-filter-error">Keep at least one item in the chart.</p>}
            <div className="ins-filter-actions">
              <button type="button" className="action-button is-ghost" onClick={() => setFilterOpen(false)}>Cancel</button>
              <button type="button" className="action-button" disabled={draftIncluded.size === 0} onClick={applyFilter}>Apply</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
