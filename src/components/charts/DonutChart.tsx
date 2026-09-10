'use client'

import { useId } from 'react'

export interface DonutSegment {
  key: string
  label: string
  emoji: string
  value: number
  color: string
}

export interface DonutArcLayout {
  key: string
  segment: DonutSegment
  startDeg: number
  endDeg: number
}

interface Props {
  segments: DonutSegment[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  size?: number
  thickness?: number
  children?: React.ReactNode
}

function pointOnCircle(cx: number, cy: number, radius: number, degrees: number) {
  const radians = ((degrees - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startDeg: number, endDeg: number) {
  const safeEnd = endDeg - startDeg >= 360 ? endDeg - 0.001 : endDeg
  const start = pointOnCircle(cx, cy, radius, startDeg)
  const end = pointOnCircle(cx, cy, radius, safeEnd)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${safeEnd - startDeg > 180 ? 1 : 0} 1 ${end.x} ${end.y}`
}

export function layoutDonutSegments(segments: DonutSegment[]): DonutArcLayout[] {
  const positive = segments.filter((segment) => segment.value > 0)
  const total = positive.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return []

  let cursor = 0
  return positive.map((segment) => {
    const startDeg = cursor
    const endDeg = cursor + (segment.value / total) * 360
    cursor = endDeg
    return { key: segment.key, segment, startDeg, endDeg }
  })
}

export function DonutChart({ segments, selectedKey, onSelect, size = 220, thickness = 30, children }: Props) {
  const titleId = useId()
  const arcs = layoutDonutSegments(segments)
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  const center = size / 2
  const radius = (size - thickness - 18) / 2

  return (
    <div className="ins-donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={titleId}>
        <title id={titleId}>Spending by {segments.length === 1 ? 'category' : 'category or group'}</title>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--erd-border)" strokeWidth={thickness} />
        {arcs.map((arc, index) => {
          const selected = selectedKey === arc.key
          const dimmed = selectedKey != null && !selected
          const middle = (arc.startDeg + arc.endDeg) / 2
          const lift = selected ? pointOnCircle(0, 0, 6, middle + 90) : { x: 0, y: 0 }
          const pct = total > 0 ? (arc.segment.value / total) * 100 : 0
          return (
            <path
              key={arc.key}
              d={arcPath(center, center, radius, arc.startDeg, arc.endDeg)}
              fill="none"
              stroke={arc.segment.color}
              strokeWidth={thickness}
              strokeLinecap={arcs.length === 1 ? 'butt' : 'round'}
              className="ins-donut-arc"
              style={{
                opacity: dimmed ? 0.38 : 1,
                transform: `translate(${lift.x}px, ${lift.y}px)`,
                animationDelay: `${80 + index * 45}ms`,
              }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${arc.segment.label}, ${pct.toFixed(1)}%`}
              onClick={() => onSelect(selected ? null : arc.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(selected ? null : arc.key)
                }
              }}
            >
              <title>{arc.segment.label} · {pct.toFixed(1)}%</title>
            </path>
          )
        })}
      </svg>
      <div className="ins-donut-center">{children}</div>
    </div>
  )
}
