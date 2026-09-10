'use client'

import { monthAbbrev } from '@/src/lib/envelope'
import { formatCurrency } from '@/lib/currency'

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

const WIDTH = 800
const HEIGHT = 260
const PAD_TOP = 38
const PAD_BOTTOM = 34
const PAD_X = 12

function compact(value: number, hidden: boolean) {
  if (hidden) return '₹••'
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `₹${Math.round(value)}`
}

export function TrendChart({ data, baseline, selectedKey, hideAmounts = false, onSelect, partialKey, partialNote }: Props) {
  if (data.length === 0) return <div className="ins-chart-empty">No spending data yet</div>

  const max = Math.max(...data.map((point) => point.value), baseline ?? 0, 1)
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = (WIDTH - PAD_X * 2) / data.length
  const barWidth = Math.min(56, Math.max(8, slot - 12))
  const baselineY = baseline == null ? null : HEIGHT - PAD_BOTTOM - (baseline / max) * plotHeight

  return (
    <div className="ins-trend-wrap">
      <div className="ins-axis-row">
        <span>{compact(max, hideAmounts)}</span>
        {baseline != null && <span>avg {compact(baseline, hideAmounts)}</span>}
      </div>
      <svg className="ins-trend-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Spending over the last 12 months">
        {baselineY != null && (
          <line x1={PAD_X} x2={WIDTH - PAD_X} y1={baselineY} y2={baselineY} className="ins-trend-baseline" />
        )}
        {data.map((point, index) => {
          const height = Math.max(3, (point.value / max) * plotHeight)
          const x = PAD_X + index * slot + (slot - barWidth) / 2
          const y = HEIGHT - PAD_BOTTOM - height
          const selected = point.date === selectedKey
          const dimmed = selectedKey != null && !selected && point.date !== partialKey
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
                style={{ opacity: dimmed ? 0.42 : 1, animationDelay: `${index * 35}ms` }}
              />
              {selected && (
                <text x={x + barWidth / 2} y={Math.max(15, y - 10)} textAnchor="middle" className="ins-trend-value">
                  {hideAmounts ? '₹••' : compact(point.value, false)}
                </text>
              )}
              <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className={selected ? 'ins-trend-label is-selected' : 'ins-trend-label'}>
                {label}
              </text>
            </g>
          )
        })}
      </svg>
      {partialKey && partialNote && data.some((point) => point.date === partialKey) && (
        <p className="ins-chart-note">* {partialNote}</p>
      )}
    </div>
  )
}
