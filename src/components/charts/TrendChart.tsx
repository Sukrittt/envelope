'use client'

import { useEffect, useRef, useState } from 'react'

import { useCurrency } from '@/src/context/CurrencyContext'

import { monthAbbrev } from '@/src/lib/envelope'


export interface TrendPoint {
  date: string
  value: number
}

interface Props {
  data: TrendPoint[]
  baseline?: number | null
  selectedKey?: string | null
  hideAmounts?: boolean
  onSelect?: (key: string) => void
  partialKey?: string | null
  partialNote?: string | null
}

const HEIGHT = 245
const PAD_TOP = 38
const PAD_BOTTOM = 34
const PAD_X = 12



export function TrendChart({ data, baseline, selectedKey, hideAmounts = false, onSelect, partialKey, partialNote }: Props) {
  const { formatCompact, formatCurrency } = useCurrency()
  // viewBox tracks the rendered width so the plot spans the whole card. A
  // fixed-width viewBox gets letterboxed into the middle of wide cards.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [WIDTH, setWidth] = useState(800)
  const empty = data.length === 0
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [empty])

  if (empty) return <div className="ins-chart-empty">No spending data yet</div>

  const max = Math.max(...data.map((point) => point.value), baseline ?? 0, 1)
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = (WIDTH - PAD_X * 2) / data.length
  // Bars fill their slot, so they widen/narrow as months are added.
  const barWidth = Math.max(8, slot - Math.min(16, slot * 0.2))
  const baselineY = baseline == null ? null : HEIGHT - PAD_BOTTOM - (baseline / max) * plotHeight

  return (
    <div className="ins-trend-wrap" ref={wrapRef}>
      <div className="ins-axis-row">
        <span>{formatCompact(max, hideAmounts)}</span>
      </div>
      <svg className="ins-trend-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Spending over the last 12 months">
        {data.map((point, index) => {
          const height = point.value > 0 ? Math.max(3, (point.value / max) * plotHeight) : 2
          const x = PAD_X + index * slot + (slot - barWidth) / 2
          const y = HEIGHT - PAD_BOTTOM - height
          const selected = point.date === selectedKey
          const dimmed = point.value === 0 || (selectedKey != null && !selected && point.date !== partialKey)
          const label = `${monthAbbrev(point.date)}${point.date === partialKey ? '*' : ''}`
          return (
            <g
              key={point.date}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${label}, ${hideAmounts ? 'amount hidden' : formatCurrency(point.value)}`}
              aria-pressed={selected}
              className="ins-trend-column"
              onClick={() => onSelect?.(point.date)}
              onKeyDown={(event) => {
                if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault()
                  onSelect(point.date)
                }
              }}
            >
              <title>{label} · {hideAmounts ? 'Amount hidden' : formatCurrency(point.value)}</title>
              <rect x={PAD_X + index * slot} y={PAD_TOP} width={slot} height={plotHeight} fill="transparent" />
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="7"
                className="ins-trend-bar"
                style={{ opacity: dimmed ? 0.42 : 1, animationDelay: `${index * 30}ms` }}
              />
              {selected && (
                <text x={x + barWidth / 2} y={Math.max(15, y - 10)} textAnchor="middle" className="ins-trend-value">
                  {formatCompact(point.value, hideAmounts)}
                </text>
              )}
              <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className={selected ? 'ins-trend-label is-selected' : 'ins-trend-label'}>
                {label}
              </text>
            </g>
          )
        })}
        {/* Drawn after the bars so tall bars don't hide it. */}
        {baselineY != null && (
          <g className="ins-trend-baseline-group">
            <line x1={PAD_X} x2={WIDTH - PAD_X} y1={baselineY} y2={baselineY} className="ins-trend-baseline" />
            <text x={PAD_X + 4} y={baselineY - 6} className="ins-trend-baseline-label">
              avg {formatCompact(baseline!, hideAmounts)}
            </text>
          </g>
        )}
      </svg>
      {partialKey && partialNote && data.some((point) => point.date === partialKey) && (
        <p className="ins-chart-note">* {partialNote}</p>
      )}
    </div>
  )
}
