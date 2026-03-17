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
  projectionData?: Array<{ date: string; value: number }>
}

export function SparkLine({
  data,
  formatValue = (v) => `${v}`,
  height = 280,
  color = 'var(--ok-fg)',
  gradientFrom = 'var(--ok-fg)',
  gradientTo = 'transparent',
  showDots = true,
  showArea = true,
  targetValue,
  targetLabel,
  projectionData,
}: SparkLineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const paddingTop = 24
  const paddingBottom = 32
  const paddingLeft = 24
  const paddingRight = 16
  const chartHeight = height - paddingTop - paddingBottom
  const svgWidth = 600

  const values = useMemo(() => data.map((d) => d.value), [data])

  const allDates = useMemo(() => {
    const dates = data.map((d) => d.date)
    if (projectionData?.length) {
      for (const p of projectionData) dates.push(p.date)
    }
    return dates
  }, [data, projectionData])

  const { min, range } = useMemo(() => {
    const allValues = [...values, ...(projectionData?.map((d) => d.value) ?? [])]
    if (!allValues.length) return { min: 0, range: 1 }
    let mn = Math.min(...allValues)
    let mx = Math.max(...allValues)
    if (targetValue != null) {
      mn = Math.min(mn, targetValue)
      mx = Math.max(mx, targetValue)
    }
    // Round to clean numbers with modest padding
    mn = Math.floor(mn - 1)
    mx = Math.ceil(mx + 1)
    return { min: mn, range: mx - mn }
  }, [values, targetValue])

  const points = useMemo(() => {
    if (!data.length) return []
    const chartWidth = svgWidth - paddingLeft - paddingRight
    const totalPoints = allDates.length
    return data.map((d, i) => ({
      x: paddingLeft + (totalPoints > 1 ? (i / (totalPoints - 1)) * chartWidth : chartWidth / 2),
      y: paddingTop + chartHeight - ((d.value - min) / range) * chartHeight,
      date: d.date,
      value: d.value,
    }))
  }, [data, allDates, min, range, chartHeight])

  const projectionPoints = useMemo(() => {
    if (!projectionData?.length || !data.length) return []
    const chartWidth = svgWidth - paddingLeft - paddingRight
    const totalPoints = allDates.length
    const offset = data.length
    return projectionData.map((d, i) => ({
      x: paddingLeft + ((offset + i) / (totalPoints - 1)) * chartWidth,
      y: paddingTop + chartHeight - ((d.value - min) / range) * chartHeight,
      date: d.date,
      value: d.value,
    }))
  }, [projectionData, data, allDates, min, range, chartHeight])

  const projectionLinePath = useMemo(() => {
    if (!projectionPoints.length || !points.length) return ''
    const lastReal = points[points.length - 1]
    const all = [lastReal, ...projectionPoints]
    let d = `M${all[0].x},${all[0].y}`
    for (let i = 1; i < all.length; i++) {
      d += ` L${all[i].x},${all[i].y}`
    }
    return d
  }, [projectionPoints, points])

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
    const top = min + range
    // Pick a clean step (2 or 5 kg intervals)
    const rawStep = range / 4
    const step = rawStep <= 2 ? 2 : rawStep <= 5 ? 5 : Math.ceil(rawStep / 5) * 5
    const ticks = []
    const first = Math.ceil(min / step) * step
    for (let val = first; val <= top; val += step) {
      ticks.push({
        value: val,
        y: paddingTop + chartHeight - ((val - min) / range) * chartHeight,
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
              x={svgWidth - paddingRight - 4}
              y={targetY - 6}
              textAnchor="end"
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

        {/* Projection line */}
        {projectionLinePath && (
          <path d={projectionLinePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray="6 4" opacity="0.5" />
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
            {Number.isInteger(tick.value) ? tick.value : tick.value.toFixed(1)}
          </text>
        ))}

        {/* X axis labels */}
        {points.map((pt, i) => {
          const totalLen = points.length + projectionPoints.length
          const showLabel = i === 0 || (i === points.length - 1 && !projectionPoints.length) || (totalLen > 5 ? i % Math.ceil(totalLen / 5) === 0 : true)
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

        {/* Projection x-axis labels (show last = ETA) */}
        {projectionPoints.length > 0 && (
          <text
            x={projectionPoints[projectionPoints.length - 1].x}
            y={height - 6}
            textAnchor="middle"
            className="spark-line-axis-label"
          >
            {formatDateLabel(projectionPoints[projectionPoints.length - 1].date)}
          </text>
        )}

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
