'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { ease, spring } from '@/src/components/landing/mobile/kit'

/** Web twin of Mobile's src/components/charts/DonutChart.tsx. Keep the timings in lockstep. */

export interface DonutSegment {
  key: string
  label: string
  emoji: string
  value: number
  color: string
}

export interface DonutArcLayout {
  key: string
  seg: DonutSegment
  startDeg: number
  endDeg: number
}

interface DonutArcTransition {
  key: string
  seg: DonutSegment
  fromStartDeg: number
  fromEndDeg: number
  toStartDeg: number
  toEndDeg: number
  fromOpacity: number
  toOpacity: number
  exiting: boolean
}

const SIZE = 200
const THICKNESS = 28
const SWEEP_DELAY = 80
const SWEEP_DURATION = 450
const MORPH_DURATION = 420
const LIFT = 6

function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = pointOnCircle(cx, cy, r, startDeg)
  const end = pointOnCircle(cx, cy, r, endDeg)
  return `M${start.x},${start.y} A${r},${r} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${end.x},${end.y}`
}

export function layoutDonutSegments(segments: DonutSegment[]): DonutArcLayout[] {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  if (total <= 0) return []
  let cursor = 0
  return segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const startDeg = cursor
      cursor += (seg.value / total) * 360
      return { key: seg.key, seg, startDeg, endDeg: cursor }
    })
}

function buildDonutTransition(previous: DonutArcLayout[], next: DonutArcLayout[]): DonutArcTransition[] {
  const previousByKey = new Map(previous.map((a) => [a.key, a]))
  const nextKeys = new Set(next.map((a) => a.key))
  return [
    ...next.map((target) => {
      const source = previousByKey.get(target.key)
      return {
        key: target.key,
        seg: target.seg,
        fromStartDeg: source?.startDeg ?? target.startDeg,
        fromEndDeg: source?.endDeg ?? target.startDeg,
        toStartDeg: target.startDeg,
        toEndDeg: target.endDeg,
        fromOpacity: source ? 1 : 0,
        toOpacity: 1,
        exiting: false,
      }
    }),
    ...previous
      .filter((source) => !nextKeys.has(source.key))
      .map((source) => ({
        key: source.key,
        seg: source.seg,
        fromStartDeg: source.startDeg,
        fromEndDeg: source.endDeg,
        toStartDeg: source.startDeg,
        toEndDeg: source.startDeg,
        fromOpacity: 1,
        toOpacity: 0,
        exiting: true,
      })),
  ]
}

const lerp = (t: number, a: number, b: number) => a + (b - a) * t
/** Reanimated `interpolate` over [0, 1, 2]. */
const tri = (t: number, [a, b, c]: [number, number, number]) => (t <= 1 ? lerp(t, a, b) : lerp(t - 1, b, c))

function DonutSlice({
  arc,
  r,
  sweep,
  isSelected,
  anySelected,
  reducedMotion,
  onPress,
}: {
  arc: DonutArcTransition
  r: number
  sweep: MotionValue<number>
  isSelected: boolean
  anySelected: boolean
  reducedMotion: boolean
  onPress: () => void
}) {
  const c = SIZE / 2
  const morph = useMotionValue(reducedMotion ? 1 : 0)
  const state = isSelected ? 2 : anySelected ? 0 : 1
  const emphasis = useMotionValue(state)

  useEffect(() => {
    if (reducedMotion) return
    const controls = animate(morph, 1, { duration: MORPH_DURATION / 1000, ease: ease.inOutCubic })
    return () => controls.stop()
  }, [morph, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return emphasis.set(state)
    const controls = animate(emphasis, state, spring)
    return () => controls.stop()
  }, [emphasis, reducedMotion, state])

  const geometry = () => {
    const m = morph.get()
    const startDeg = lerp(m, arc.fromStartDeg, arc.toStartDeg)
    const endDeg = Math.min(lerp(m, arc.fromEndDeg, arc.toEndDeg), startDeg + 359.999)
    const span = Math.max(0.001, endDeg - startDeg)
    return { startDeg, endDeg, span, len: 2 * Math.PI * r * (span / 360) }
  }
  const d = useTransform(() => {
    const g = geometry()
    return arcPath(c, c, r, g.startDeg, g.endDeg)
  })
  const dash = useTransform(() => {
    const { len } = geometry()
    return `${len} ${len}`
  })
  const dashOffset = useTransform(() => {
    const g = geometry()
    const revealed = Math.max(0, Math.min(1, (sweep.get() * 360 - g.startDeg) / g.span))
    return g.len * (1 - revealed)
  })
  const strokeWidth = useTransform(() => tri(emphasis.get(), [THICKNESS, THICKNESS, THICKNESS + 4]))
  const strokeOpacity = useTransform(
    () => tri(emphasis.get(), [0.35, 1, 1]) * lerp(morph.get(), arc.fromOpacity, arc.toOpacity),
  )
  const lift = (axis: 'x' | 'y') => () => {
    const g = geometry()
    const dir = pointOnCircle(0, 0, 1, (g.startDeg + g.endDeg) / 2)
    return dir[axis] * tri(emphasis.get(), [0, 0, LIFT])
  }
  const x = useTransform(lift('x'))
  const y = useTransform(lift('y'))
  const pct = ((arc.toEndDeg - arc.toStartDeg) / 360) * 100

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={arc.seg.color}
      strokeLinecap="butt"
      strokeWidth={strokeWidth}
      strokeOpacity={strokeOpacity}
      strokeDasharray={dash}
      strokeDashoffset={dashOffset}
      style={{ x, y, cursor: arc.exiting ? 'default' : 'pointer', outline: 'none' }}
      role={arc.exiting ? undefined : 'button'}
      tabIndex={arc.exiting ? undefined : 0}
      aria-pressed={arc.exiting ? undefined : isSelected}
      aria-label={`${arc.seg.label}, ${pct.toFixed(1)}%`}
      onClick={arc.exiting ? undefined : onPress}
      onKeyDown={(event) => {
        if (arc.exiting || (event.key !== 'Enter' && event.key !== ' ')) return
        event.preventDefault()
        onPress()
      }}
    />
  )
}

/** Interactive donut whose segment changes morph in place. */
export function DonutChart({
  segments,
  selectedKey,
  onSelect,
  revealKey,
  children,
}: {
  segments: DonutSegment[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  /** Bumped for entrance and scope-change wipes. */
  revealKey: number
  children?: ReactNode
}) {
  const reducedMotion = !!useReducedMotion()
  const nextLayout = useMemo(() => layoutDonutSegments(segments), [segments])
  const signature = nextLayout.map((a) => `${a.key}:${a.seg.value}:${a.seg.color}`).join('|')
  const [arcs, setArcs] = useState(() => ({
    signature,
    layout: nextLayout,
    rendered: buildDonutTransition(nextLayout, nextLayout),
    key: 0,
  }))
  if (arcs.signature !== signature) {
    setArcs({ signature, layout: nextLayout, rendered: buildDonutTransition(arcs.layout, nextLayout), key: arcs.key + 1 })
  }
  const sweep = useMotionValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    if (reducedMotion || !arcs.rendered.some((a) => a.exiting)) return
    const id = setTimeout(
      () => setArcs((s) => ({ ...s, rendered: buildDonutTransition(s.layout, s.layout) })),
      MORPH_DURATION + 30,
    )
    return () => clearTimeout(id)
    // Keyed on the transition, not on every array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcs.key, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return sweep.set(1)
    if (!nextLayout.length || !revealKey) return
    sweep.set(0)
    const controls = animate(sweep, 1, { delay: SWEEP_DELAY / 1000, duration: SWEEP_DURATION / 1000, ease: ease.inOutCubic })
    return () => controls.stop()
  }, [sweep, nextLayout.length, reducedMotion, revealKey])

  const r = (SIZE - THICKNESS) / 2 - (LIFT + 2)
  return (
    <div className="ins-donut" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Spending breakdown">
        {arcs.rendered.map((arc) => (
          <DonutSlice
            key={`${arcs.key}:${arc.key}`}
            arc={arc}
            r={r}
            sweep={sweep}
            isSelected={!arc.exiting && selectedKey === arc.key}
            anySelected={selectedKey != null}
            reducedMotion={reducedMotion}
            onPress={() => onSelect(selectedKey === arc.key ? null : arc.key)}
          />
        ))}
      </svg>
      <div className="ins-donut-center">{children}</div>
    </div>
  )
}
