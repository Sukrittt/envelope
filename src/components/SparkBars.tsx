import { useMemo, useState, useRef, useEffect } from 'react'
import { animate, spring } from 'motion'

interface SparkBarDatum {
  date: string
  value: number
  categories?: Record<string, number>
}

interface SparkBarsProps {
  data: Array<SparkBarDatum>
  formatValue?: (value: number) => string
  size?: 'compact' | 'default' | 'expanded'
  capOutliers?: boolean
  outlierThreshold?: number
  outlierPercentile?: number
  onBarClick?: (index: number) => void
  enableFluidInteractions?: boolean
}

export function SparkBars({
  data,
  formatValue = (value) => `${value}`,
  size = 'default',
  capOutliers = false,
  outlierThreshold = 1.6,
  outlierPercentile = 0.9,
  onBarClick,
  enableFluidInteractions = true,
}: SparkBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const barRefs = useRef<Array<HTMLDivElement | null>>([])
  const animationRefs = useRef<Array<{ animation?: ReturnType<typeof animate> }>>([])

  // Track pointer position for direct manipulation
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number; time: number } | null>(null)
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null)

  const values = data.map((row) => row.value).filter((value) => Number.isFinite(value))

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

  const avgNormalized = maxValue ? Math.max(0, Math.min(1, avg / maxValue)) : 0
  const avgOffset = avgNormalized * 100

  const labelEvery = data.length > 8 ? Math.max(1, Math.floor(data.length / 6)) : 1

  // Handle pointer down for immediate feedback
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (!enableFluidInteractions) return
    setIsPointerDown(true)
    setActiveBarIndex(index)
    setPointerPosition({ x: e.clientX, y: e.clientY, time: Date.now() })

    // Immediate feedback on pointer down
    const barElement = barRefs.current[index]
    if (barElement) {
      barElement.style.transform = 'scale(0.98)'
      barElement.style.transition = 'transform 0.05s ease-out'
    }
  }

  // Handle pointer move for direct manipulation
  const handlePointerMove = (index: number, e: React.PointerEvent) => {
    if (!enableFluidInteractions || !isPointerDown || activeBarIndex !== index) return
    setPointerPosition({ x: e.clientX, y: e.clientY, time: Date.now() })
  }

  // Handle pointer up for velocity handoff
  const handlePointerUp = (index: number, e: React.PointerEvent) => {
    if (!enableFluidInteractions) return
    setIsPointerDown(false)
    setActiveBarIndex(null)

    const barElement = barRefs.current[index]
    if (barElement) {
      // Reset transform immediately
      barElement.style.transform = ''

      // Interrupt any running spring for this bar before starting a new one
      animationRefs.current[index]?.animation?.cancel()

      // Reduced motion: bar returns to rest instantly, no release spring
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return
      }

      // Calculate velocity based on pointer movement
      let velocityY = 0
      if (pointerPosition) {
        const currentTime = Date.now()
        const timeDiff = currentTime - pointerPosition.time
        if (timeDiff > 0 && timeDiff < 100) {
          const yDiff = e.clientY - pointerPosition.y
          velocityY = yDiff / timeDiff * 1000 // px/s
        }
      }

      // Spring animation back to original position
      const animation = animate(barElement,
        { transform: ['scale(0.98)', 'scale(1)'] },
        {
          type: 'spring',
          bounce: 0.4,
          duration: 0.6,
          velocity: velocityY
        }
      )

      // Store animation reference for interruptibility
      animationRefs.current[index] = { animation }
    }
  }

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      animationRefs.current.forEach(ref => {
        ref.animation?.cancel()
      })
    }
  }, [])

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
      <div className="spark-bars-inner" onMouseLeave={() => setHoveredIndex(null)}>
        {avg > 0 && (
          <div className="spark-avg-line" style={{ bottom: `${avgOffset}%` }} />
        )}
        {data.map((row, index) => {
          const normalized = maxValue ? Math.max(0, Math.min(1, row.value / maxValue)) : 0
          const height = normalized * 100
          const prev = data[index - 1]
          const delta = prev ? row.value - prev.value : 0
          const deltaPct = prev ? ((row.value - prev.value) / prev.value) * 100 : 0
          const isCurrent = index === data.length - 1
          const isHovered = hoveredIndex === index
          const isActive = activeBarIndex === index

          const isZero = row.value === 0
          const isToday = row.date === new Date().toISOString().slice(0, 10)

          return (
            <div
              key={`${row.date}-${index}`}
              className={`spark-bar-wrap ${isCurrent ? 'is-current' : ''} ${isHovered ? 'is-hovered' : ''} ${isToday ? 'is-today' : ''} ${onBarClick ? 'is-clickable' : ''} ${isActive ? 'is-active' : ''}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onClick={() => onBarClick?.(index)}
              onPointerDown={(e: React.PointerEvent) => handlePointerDown(index, e)}
              onPointerMove={(e: React.PointerEvent) => handlePointerMove(index, e)}
              onPointerUp={(e: React.PointerEvent) => handlePointerUp(index, e)}
              onPointerLeave={(e: React.PointerEvent) => {
                if (isPointerDown && activeBarIndex === index) {
                  handlePointerUp(index, e)
                }
              }}
              style={{ touchAction: 'none' }}
            >
              <div className="spark-bar-track">
                <div
                  ref={el => { barRefs.current[index] = el }}
                  className={`spark-bar ${isZero ? 'spark-bar-zero' : ''}`}
                  style={{ height: isZero ? '2px' : `${height}%` }}
                />
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
