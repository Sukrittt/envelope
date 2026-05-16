import { useMemo, useState } from 'react'

interface SparkBarsProps {
  data: Array<{ date: string; value: number }>
  formatValue?: (value: number) => string
  size?: 'compact' | 'default' | 'expanded'
  showReferenceLines?: boolean
  capOutliers?: boolean
  outlierThreshold?: number
  outlierPercentile?: number
  onBarClick?: (index: number) => void
}

export function SparkBars({
  data,
  formatValue = (value) => `${value}`,
  size = 'default',
  showReferenceLines = false,
  capOutliers = false,
  outlierThreshold = 1.6,
  outlierPercentile = 0.9,
  onBarClick,
}: SparkBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const values = data.map((row) => row.value).filter((value) => Number.isFinite(value))

  const rawMin = values.length ? Math.min(...values, 0) : 0
  const rawMax = values.length ? Math.max(...values, 0) : 0

  const scaleMax = useMemo(() => {
    if (!capOutliers || values.length < 3) return Math.max(rawMax, 0)
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * outlierPercentile)))
    const percentileValue = sorted[idx] ?? rawMax
    if (!percentileValue) return Math.max(rawMax, 0)
    return rawMax > percentileValue * outlierThreshold ? percentileValue : Math.max(rawMax, 0)
  }, [capOutliers, outlierPercentile, outlierThreshold, rawMax, values])

  const maxValue = Math.max(scaleMax, 0)

  const avg = useMemo(() => {
    if (!data.length) return 0
    return data.reduce((sum, row) => sum + row.value, 0) / data.length
  }, [data])

  const referenceLevels = useMemo(() => {
    if (!showReferenceLines) return []
    return [
      { label: 'Max', value: rawMax },
      { label: 'Average', value: avg },
      { label: 'Min', value: rawMin },
    ]
  }, [avg, rawMax, rawMin, showReferenceLines])

  const yTicks = useMemo(() => {
    const top = maxValue
    const mid = rawMin + (maxValue - rawMin) / 2
    const low = rawMin
    return [top, mid, low]
  }, [maxValue, rawMin])

  const labelEvery = size === 'expanded' ? 2 : size === 'default' ? 2 : 4

  function getLabel(input: string): string {
    if (/^\d{4}-\d{2}$/.test(input)) {
      const d = new Date(`${input}-01`)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { month: 'short' })
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const d = new Date(input)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      }
    }

    return input
  }

  function getDateRange(index: number): string {
    const current = data[index]
    if (!current) return ''
    const next = data[index + 1]
    if (next) {
      const start = new Date(current.date)
      const end = new Date(next.date)
      end.setDate(end.getDate() - 1)
      const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      return `${fmt(start)} – ${fmt(end)}`
    }
    return getLabel(current.date)
  }

  return (
    <div className={`spark-bars spark-bars--${size}`} role="img" aria-label="Expense trend chart">
      <div className="spark-scale" aria-hidden="true">
        {yTicks.map((tick) => (
          <span key={tick}>{formatValue(tick)}</span>
        ))}
      </div>

      {showReferenceLines ? (
        <div className="spark-reference-grid" aria-hidden="true">
          {referenceLevels.map((level) => {
            const normalized = maxValue ? Math.max(0, Math.min(1, level.value / maxValue)) : 0
            const offset = normalized * 100
            return (
              <div key={level.label} className="spark-reference-line" style={{ bottom: `${offset}%` }}>
                <span>{level.label}</span>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="spark-bars-inner" onMouseLeave={() => setHoveredIndex(null)}>
        {data.map((row, index) => {
          const normalized = maxValue ? Math.max(0, Math.min(1, row.value / maxValue)) : 0
          const height = normalized * 100
          const prev = data[index - 1]
          const delta = prev ? row.value - prev.value : 0
          const deltaPct = prev ? ((row.value - prev.value) / prev.value) * 100 : 0
          const isCurrent = index === data.length - 1
          const isHovered = hoveredIndex === index

          const isZero = row.value === 0

          return (
            <div
              key={`${row.date}-${index}`}
              className={`spark-bar-wrap ${isCurrent ? 'is-current' : ''} ${isHovered ? 'is-hovered' : ''} ${onBarClick ? 'is-clickable' : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => onBarClick?.(index)}
            >
              <div className="spark-bar-track">
                <div className={`spark-bar ${isZero ? 'spark-bar-zero' : ''}`} style={{ height: `${isZero ? 2 : height}%` }} />
              </div>
              <span>{index % labelEvery === 0 || index === data.length - 1 ? getLabel(row.date) : ''}</span>

              {isHovered && (
                <div className="spark-tooltip">
                  <strong>{getDateRange(index)}</strong>
                  <span>Total: {formatValue(row.value)}</span>
                  {prev && (
                    <span className={delta > 0 ? 'spark-tooltip-down' : 'spark-tooltip-up'}>
                      vs previous: {delta > 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
