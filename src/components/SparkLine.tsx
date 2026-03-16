import { useMemo, useState } from 'react'

interface SparkLineProps {
  data: Array<{ date: string; value: number }>
  formatValue?: (value: number) => string
  height?: number
  color?: string
  gradientFrom?: string
  gradientTo?: string
  showDots?: boolean
  showArea?: boolean
  targetValue?: number
  targetLabel?: string
}

export function SparkLine({
  data,
  formatValue = (v) => `${v}`,
  height = 200,
  color = 'var(--ok-fg)',
  gradientFrom = 'var(--ok-fg)',
  gradientTo = 'transparent',
  showDots = true,
  showArea = true,
  targetValue,
  targetLabel,
}: SparkLineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const paddingTop = 24
  const paddingBottom = 32
  const paddingLeft = 52
  const paddingRight = 16
  const chartHeight = height - paddingTop - paddingBottom
  const svgWidth = 600

  const values = useMemo(() => data.map((d) => d.value), [data])

  const { min, range } = useMemo(() => {
    if (!values.length) return { min: 0, max: 0, range: 1 }
    const mn = Math.min(...values)
    const mx = Math.max(...values)
    const pad = (mx - mn) * 0.12 || 1
    return { min: mn - pad, max: mx + pad, range: mx - mn + pad * 2 }
  }, [values])

  const points = useMemo(() => {
    if (!data.length) return []
    const chartWidth = svgWidth - paddingLeft - paddingRight
    return data.map((d, i) => ({
      x: paddingLeft + (data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2),
      y: paddingTop + chartHeight - ((d.value - min) / range) * chartHeight,
      date: d.date,
      value: d.value,
    }))
  }, [data, min, range, chartHeight])

  const linePath = useMemo(() => {
    if (points.length < 2) return ''
    // Smooth catmull-rom style path
    const pts = points
    let d = `M${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }, [points])

  const areaPath = useMemo(() => {
    if (!linePath || !points.length) return ''
    const bottom = paddingTop + chartHeight
    return `${linePath} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z`
  }, [linePath, points, chartHeight])

  const yTicks = useMemo(() => {
    const count = 4
    const ticks = []
    for (let i = 0; i <= count; i++) {
      const val = min + (range * i) / count
      ticks.push({
        value: val,
        y: paddingTop + chartHeight - (i / count) * chartHeight,
      })
    }
    return ticks
  }, [min, range, chartHeight])

  const targetY = targetValue != null
    ? paddingTop + chartHeight - ((targetValue - min) / range) * chartHeight
    : null

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const gradientId = 'spark-line-gradient'

  return (
    <div className="spark-line" onMouseLeave={() => setHoveredIndex(null)}>
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="none"
        className="spark-line-svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.25" />
            <stop offset="100%" stopColor={gradientTo} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick.value}
            x1={paddingLeft}
            y1={tick.y}
            x2={svgWidth - paddingRight}
            y2={tick.y}
            className="spark-line-grid"
          />
        ))}

        {/* Target line */}
        {targetY != null && (
          <>
            <line
              x1={paddingLeft}
              y1={targetY}
              x2={svgWidth - paddingRight}
              y2={targetY}
              className="spark-line-target"
            />
            <text
              x={svgWidth - paddingRight + 4}
              y={targetY + 3}
              className="spark-line-target-label"
            >
              {targetLabel ?? formatValue(targetValue!)}
            </text>
          </>
        )}

        {/* Area fill */}
        {showArea && areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Line */}
        {linePath && (
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots */}
        {showDots && points.map((pt, i) => (
          <circle
            key={pt.date}
            cx={pt.x}
            cy={pt.y}
            r={hoveredIndex === i ? 5 : 3.5}
            fill={i === data.length - 1 ? color : 'var(--panel)'}
            stroke={color}
            strokeWidth="2"
            className="spark-line-dot"
            onMouseEnter={() => setHoveredIndex(i)}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick.value}
            x={paddingLeft - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="spark-line-axis-label"
          >
            {tick.value.toFixed(1)}
          </text>
        ))}

        {/* X axis labels */}
        {points.map((pt, i) => {
          const showLabel = i === 0 || i === points.length - 1 || (points.length > 5 ? i % Math.ceil(points.length / 5) === 0 : true)
          if (!showLabel) return null
          return (
            <text
              key={pt.date}
              x={pt.x}
              y={height - 6}
              textAnchor="middle"
              className="spark-line-axis-label"
            >
              {formatDateLabel(pt.date)}
            </text>
          )
        })}

        {/* Hover vertical line */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <line
            x1={points[hoveredIndex].x}
            y1={paddingTop}
            x2={points[hoveredIndex].x}
            y2={paddingTop + chartHeight}
            className="spark-line-hover-rule"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="spark-line-tooltip"
          style={{
            left: `${(points[hoveredIndex].x / svgWidth) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100}%`,
          }}
        >
          <strong>{formatDateLabel(points[hoveredIndex].date)}</strong>
          <span>{formatValue(points[hoveredIndex].value)}</span>
          {hoveredIndex > 0 && (
            <span className={points[hoveredIndex].value < points[hoveredIndex - 1].value ? 'spark-line-delta-down' : 'spark-line-delta-up'}>
              {(points[hoveredIndex].value - points[hoveredIndex - 1].value) > 0 ? '+' : ''}
              {(points[hoveredIndex].value - points[hoveredIndex - 1].value).toFixed(2)} kg
            </span>
          )}
        </div>
      )}
    </div>
  )
}
