import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import type { Envelope } from '../types/expense'

interface Props {
  envelopes: Envelope[]
  expenseRows: Array<{ date: string; amountInr: number; category: string }>
  month: string
  canGoNext: boolean
  onNavigate: (delta: number) => void
}

function fmt(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function buildReview(envelopes: Envelope[]): { wentWrong: string; nextAction: string } {
  const ccEnvelope = envelopes.find(e => e.isCreditCardPayment)
  const ccBalance = ccEnvelope?.available ?? 0

  const spendingEnvelopes = envelopes.filter(e => !e.isCreditCardPayment)
  const overspent = spendingEnvelopes
    .filter(e => e.isOverspent)
    .sort((a, b) => a.available - b.available)

  const hasSurplus = spendingEnvelopes.filter(e => e.available > 0)

  let wentWrong = ''
  let nextAction = ''

  if (overspent.length > 0) {
    const worst = overspent[0]
    const deficit = Math.abs(worst.available)
    wentWrong = `${worst.category} is overspent by ${fmt(deficit)} — the largest drag this month.`
    if (overspent.length > 1) {
      const second = overspent[1]
      const secondDeficit = Math.abs(second.available)
      wentWrong += ` ${second.category} follows at ${fmt(secondDeficit)}.`
    }
  } else if (ccBalance > 0 && overspent.length === 0) {
    wentWrong = `Credit card payment of ${fmt(ccBalance)} is pending.`
  } else if (spendingEnvelopes.length > 0) {
    const low = [...spendingEnvelopes].sort((a, b) => a.available - b.available)[0]
    wentWrong = `${low.category} has only ${fmt(low.available)} left — keep an eye on it.`
  } else {
    wentWrong = 'No envelopes with data this month.'
  }

  if (ccBalance > 0) {
    nextAction = `Pay credit card bill (${fmt(ccBalance)}) — the money is set aside in the Credit Card envelope.`
  } else if (overspent.length > 0 && hasSurplus.length > 0) {
    const worst = overspent[0]
    const best = [...hasSurplus].sort((a, b) => b.available - a.available)[0]
    nextAction = `Move money from ${best.category} (${fmt(best.available)} available) to cover the ${worst.category} overspend.`
  } else if (overspent.length === 0 && hasSurplus.length > 1) {
    const best = [...hasSurplus].sort((a, b) => b.available - a.available)[0]
    nextAction = `${best.category} has ${fmt(best.available)} unspent — consider reallocating to next month or padding tight categories.`
  } else {
    nextAction = 'All categories are within budget. Keep up the discipline.'
  }

  return { wentWrong, nextAction }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildHeatmap(expenseRows: Array<{ date: string; amountInr: number; category: string }>, month: string) {
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const today = todayISO()

  const dailyTotals = new Map<string, number>()
  const dailyCats = new Map<string, Map<string, number>>()

  for (const row of expenseRows) {
    if (!row.date.startsWith(month)) continue
    const prev = dailyTotals.get(row.date) ?? 0
    dailyTotals.set(row.date, prev + row.amountInr)
    if (!dailyCats.has(row.date)) dailyCats.set(row.date, new Map())
    const catMap = dailyCats.get(row.date)!
    catMap.set(row.category, (catMap.get(row.category) ?? 0) + row.amountInr)
  }

  const nonZeroTotals = Array.from(dailyTotals.values()).filter(v => v > 0).sort((a, b) => a - b)

  const cells: { day: number; date: string; total: number; topCat: string; level: number; isToday: boolean }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`
    const total = dailyTotals.get(dateStr) ?? 0
    const cats = dailyCats.get(dateStr)
    let topCat = ''
    let topAmt = 0
    if (cats) {
      for (const [cat, amt] of cats) {
        if (amt > topAmt) { topCat = cat; topAmt = amt }
      }
    }

    let level = 0
    if (total > 0 && nonZeroTotals.length > 0) {
      const rank = nonZeroTotals.findIndex(v => v >= total)
      const percentile = rank / nonZeroTotals.length
      level = Math.min(Math.floor(percentile * 4), 3) + 1
    }

    cells.push({
      day: d,
      date: dateStr,
      total,
      topCat,
      level,
      isToday: dateStr === today,
    })
  }

  return { cells, daysInMonth }
}

const LEVEL_COLORS = [
  'transparent',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.16)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.38)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.62)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.88)',
]

const LEGEND_SWATCHES = [
  'transparent',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.16)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.38)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.62)',
  'rgba(var(--accent-rgb, 88, 130, 255), 0.88)',
]

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function firstDayOffset(month: string): number {
  const [y, m] = month.split('-').map(Number)
  const day = new Date(y, m - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function monthLabel(month: string): string {
  const d = new Date(`${month}-01`)
  if (Number.isNaN(d.getTime())) return month
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export function SpendingInsights({ envelopes, expenseRows, month, canGoNext, onNavigate }: Props) {
  const [tooltip, setTooltip] = useState<{ day: number; date: string; total: number; topCat: string; x: number; y: number } | null>(null)
  const router = useRouter()
  const reduce = useReducedMotion()

  const review = useMemo(() => buildReview(envelopes), [envelopes])
  const heatmap = useMemo(() => buildHeatmap(expenseRows, month), [expenseRows, month])
  const offset = useMemo(() => firstDayOffset(month), [month])

  function handleCellClick(e: React.MouseEvent) {
    const date = (e.currentTarget as HTMLElement).getAttribute('data-date')
    if (date) router.push(`/expense/transactions?date=${date}`)
  }

  return (
    <article className="mc-panel expense-insights-panel">
      <div className="mc-panel-header">
        <h3>Insights</h3>
        <div className="si-month-nav">
          <button type="button" className="si-month-btn" onClick={() => onNavigate(-1)} aria-label="Previous month">‹</button>
          <span className="si-month-label">{monthLabel(month)}</span>
          <button type="button" className="si-month-btn" onClick={() => onNavigate(1)} disabled={!canGoNext} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="si-review">
        <div className="si-review-block">
          <span className="si-review-label">What went wrong</span>
          <p className="si-review-text">{review.wentWrong}</p>
        </div>
        <div className="si-review-block">
          <span className="si-review-label">What to do next</span>
          <p className="si-review-text">{review.nextAction}</p>
        </div>
      </div>

      <div className="si-heatmap">
        <div className="si-heatmap-grid">
          <div className="si-heatmap-row si-heatmap-headers">
            {DAY_HEADERS.map(h => (
              <span key={h} className="si-heatmap-dow">{h}</span>
            ))}
          </div>
          {Array.from({ length: Math.ceil((offset + heatmap.daysInMonth) / 7) }).map((_, weekIdx) => (
            <div key={weekIdx} className="si-heatmap-row">
              {Array.from({ length: 7 }).map((_, dayIdx) => {
                const cellIdx = weekIdx * 7 + dayIdx - offset
                const cell = cellIdx >= 0 && cellIdx < heatmap.cells.length ? heatmap.cells[cellIdx] : null
                return cell ? (
                    <div
                      key={cell.date}
                      className={`si-heatmap-cell ${cell.isToday ? 'si-heatmap-today' : ''}`}
                      style={{ backgroundColor: LEVEL_COLORS[cell.level] }}
                      data-date={cell.date}
                      onClick={(e) => handleCellClick(e)}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setTooltip({ ...cell, x: rect.left + rect.width / 2, y: rect.top - 28 })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span className="si-heatmap-cell-num">{cell.day}</span>
                    </div>
                ) : (
                  <div key={`empty-${cellIdx}`} className="si-heatmap-cell si-heatmap-cell-empty" />
                )
              })}
            </div>
          ))}
        </div>

        {tooltip && createPortal(
          <motion.div
            className="si-heatmap-tooltip"
            style={{ left: tooltip.x, top: tooltip.y, x: '-50%', y: '-100%' }}
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'tween', duration: 0.12, ease: 'easeOut' }}
          >
            <strong>{new Date(tooltip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong>
            {tooltip.total > 0 ? (
              <>
                <span>Total: {fmt(tooltip.total)}</span>
                {tooltip.topCat && <span>mostly {tooltip.topCat}</span>}
              </>
            ) : (
              <span>No spend</span>
            )}
          </motion.div>,
          document.body
        )}

        <div className="si-heatmap-legend">
          <span className="si-heatmap-legend-label">Low</span>
          {LEGEND_SWATCHES.map((c, i) => (
            <span key={i} className="si-heatmap-legend-swatch" style={{ background: c }} />
          ))}
          <span className="si-heatmap-legend-label">High</span>
        </div>
      </div>
    </article>
  )
}
