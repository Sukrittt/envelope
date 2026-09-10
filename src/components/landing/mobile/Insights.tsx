'use client'

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { ArrowLeft, Check, ListFilter, Play } from 'lucide-react'
import { formatCurrency } from '@/src/lib/format'
import type { ThemeTokens } from '@/src/theme/tokens'
import {
  AmountText,
  BottomSheet,
  Button,
  IconButton,
  NAV_HEIGHT,
  PHONE,
  PopIn,
  T,
  col,
  ease,
  font,
  pressable,
  radius,
  row,
  space,
  spring,
  type,
} from './kit'
import { MONTH_LABEL, breakdownRows, type BreakdownRow, type DemoCategory } from './demo'

/** Twin of Mobile's app/insights.tsx header + charts/{CategoryBreakdown,DonutChart,useReveal}.tsx. */

export function InsightsScreen({
  categories,
  onBack,
  notice,
}: {
  categories: DemoCategory[]
  onBack: () => void
  notice: (message: string) => void
}) {
  const [mode, setMode] = useState<'category' | 'group'>('category')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { categoryRows, groupRows, categoryGroupMap } = useMemo(() => breakdownRows(categories), [categories])

  const stepBtn = (enabled: boolean): CSSProperties => ({
    ...pressable,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    ...row,
    justifyContent: 'center',
    background: enabled ? T.accentSoft : T.border,
    color: enabled ? T.accentInk : T.text3,
    fontSize: type.bodyLg,
    lineHeight: `${type.bodyLg}px`,
    cursor: enabled ? 'pointer' : 'default',
  })

  return (
    <div style={{ ...col, height: '100%', background: T.bg }}>
      <div style={{ ...row, alignItems: 'flex-start', gap: space.md, paddingTop: PHONE.top + space.md, paddingInline: space.lg, paddingBottom: space.sm }}>
        <IconButton icon={ArrowLeft} label="Back" onPress={onBack} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ color: T.text, fontSize: type.title, ...font.displaySemiBold, letterSpacing: -0.3, whiteSpace: 'nowrap' }}>
            {MONTH_LABEL}
          </span>
        </div>
        <div style={{ ...row, gap: space.xs }}>
          <button type="button" aria-label="Previous month" style={stepBtn(true)} onClick={() => notice('Past months live in the app.')}>
            ‹
          </button>
          <button type="button" aria-label="Next month" disabled style={stepBtn(false)}>
            ›
          </button>
        </div>
      </div>

      <div className="m-noscroll" style={{ flex: 1, overflowY: 'auto', paddingInline: space.lg, paddingBottom: NAV_HEIGHT + PHONE.bottom + space.lg }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: radius.lg, padding: space.lg, marginTop: space.sm }}>
          <CategoryBreakdown
            rows={mode === 'category' ? categoryRows : groupRows}
            categoryRows={categoryRows}
            groupRows={groupRows}
            categoryGroupMap={categoryGroupMap}
            mode={mode}
            onModeChange={setMode}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            leftover={0}
            monthLabel={MONTH_LABEL}
            notice={notice}
          />
        </div>
      </div>
    </div>
  )
}

// ─── useReveal ───────────────────────────────────────────────────────────────

/** Roughly the screen's slide-in, after which an entrance is worth watching. */
const SETTLE_MS = 320

function useReveal(scope: string, ready: boolean) {
  const [settled, setSettled] = useState(false)
  const [revealed, setRevealed] = useState({ scope: '', nonce: 0 })
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(id)
  }, [])
  if (settled && ready && revealed.scope !== scope) setRevealed({ scope, nonce: revealed.nonce + 1 })
  return {
    revealKey: revealed.nonce,
    revealReady: settled && ready && revealed.scope === scope && revealed.nonce > 0,
  }
}

// ─── CategoryBreakdown ───────────────────────────────────────────────────────

const CHART_COLOR_CYCLE: (keyof ThemeTokens)[] = ['blue', 'mint', 'violet', 'accent', 'coral', 'warn']
const VISIBLE_ROWS = 6
const DONUT_TAIL_PCT = 3
const ROW_START_DELAY = 200
const ROW_STAGGER_MS = 40
const ROW_STAGGER_CAP = 6
const BAR_OFFSET_MS = 60
const BAR_DURATION = 450
const FILTER_APPLY_DELAY_MS = 220
const LIST_SPRING = { type: 'spring', damping: 64, stiffness: 700, mass: 1 } as const

const groupFor = (map: ReadonlyMap<string, string>, key: string) => map.get(key) || 'Other'

function BudgetBar({ spent, assigned, color, play, delay }: { spent: number; assigned: number; color: string; play: boolean; delay: number }) {
  const pct = (spent / assigned) * 100
  const [initial] = useState(() => (play ? { width: '0%' } : false))
  return (
    <div style={{ height: 6, borderRadius: 100, overflow: 'hidden', background: T.borderStrong }}>
      <motion.div
        style={{ height: '100%', borderRadius: 100, background: pct > 100 ? T.coral : color }}
        initial={initial}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ delay: delay / 1000, duration: BAR_DURATION / 1000, ease: ease.inOutCubic }}
      />
    </div>
  )
}

function Delta({ pct, size, textSize }: { pct: number; size: number; textSize: number }) {
  const color = pct > 0 ? T.coral : T.mint
  return (
    <>
      <span style={{ display: 'flex', transform: `rotate(${pct > 0 ? -90 : 90}deg)` }}>
        <Play size={size} color={color} fill={color} />
      </span>
      <span style={{ color, fontSize: textSize, ...font.bodySemiBold }}>{Math.abs(pct).toFixed(0)}%</span>
    </>
  )
}

function CategoryBreakdown({
  rows,
  categoryRows,
  groupRows,
  categoryGroupMap,
  mode,
  onModeChange,
  selectedKey,
  onSelectKey,
  leftover,
  monthLabel,
  notice,
}: {
  rows: BreakdownRow[]
  categoryRows: BreakdownRow[]
  groupRows: BreakdownRow[]
  categoryGroupMap: ReadonlyMap<string, string>
  mode: 'category' | 'group'
  onModeChange: (mode: 'category' | 'group') => void
  selectedKey: string | null
  onSelectKey: (key: string | null) => void
  leftover: number
  monthLabel: string
  notice: (message: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<'spend' | 'budget'>('spend')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<'category' | 'group'>('category')
  const [excludedCategoryKeys, setExcludedCategoryKeys] = useState<Set<string>>(() => new Set())
  const [excludedGroupKeys, setExcludedGroupKeys] = useState<Set<string>>(() => new Set())
  const [draftCategoryKeys, setDraftCategoryKeys] = useState<Set<string> | null>(null)
  const [draftGroupKeys, setDraftGroupKeys] = useState<Set<string> | null>(null)
  const [pendingFilters, setPendingFilters] = useState<{ categories: Set<string>; groups: Set<string> } | null>(null)

  const eligibleGroupRows = useMemo(() => {
    const withCategories = new Set(categoryRows.map((r) => groupFor(categoryGroupMap, r.key)))
    return groupRows.filter((r) => withCategories.has(r.key))
  }, [categoryRows, groupRows, categoryGroupMap])

  const displayRows = useMemo(() => {
    const included = categoryRows.filter(
      (r) => !excludedCategoryKeys.has(r.key) && !excludedGroupKeys.has(groupFor(categoryGroupMap, r.key)),
    )
    const filtered =
      mode === 'category'
        ? included
        : eligibleGroupRows
            .map((group) => {
              const members = included.filter((r) => groupFor(categoryGroupMap, r.key) === group.key)
              if (members.length === 0) return null
              if (members.length === categoryRows.filter((r) => groupFor(categoryGroupMap, r.key) === group.key).length) return group
              const spent = members.reduce((sum, r) => sum + r.spent, 0)
              const previousSpent = members.reduce((sum, r) => (r.deltaPct == null ? sum : sum + r.spent / (1 + r.deltaPct / 100)), 0)
              return {
                ...group,
                spent,
                assigned: members.reduce((sum, r) => sum + r.assigned, 0),
                assignedIsCarried: members.every((r) => r.assignedIsCarried),
                deltaPct: previousSpent > 0 ? ((spent - previousSpent) / previousSpent) * 100 : null,
              }
            })
            .filter((r): r is BreakdownRow => r != null)
    const total = filtered.reduce((s, r) => s + r.spent, 0) || 1
    return filtered.map((r) => ({ ...r, pct: (r.spent / total) * 100 }))
  }, [categoryRows, eligibleGroupRows, excludedCategoryKeys, excludedGroupKeys, mode, categoryGroupMap])

  const displayTotal = displayRows.reduce((s, r) => s + r.spent, 0)
  const { revealKey, revealReady } = useReveal(`${monthLabel}|${mode}`, displayRows.length > 0)
  const play = revealReady

  const colorByKey = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach((r, i) => map.set(r.key, T[CHART_COLOR_CYCLE[i % CHART_COLOR_CYCLE.length]]))
    return map
  }, [rows])

  const segments = useMemo(() => {
    const big = displayRows.filter((r) => r.pct >= DONUT_TAIL_PCT)
    const small = displayRows.filter((r) => r.pct < DONUT_TAIL_PCT)
    const result: DonutSegment[] = big.map((r) => ({
      key: r.key,
      label: r.label,
      emoji: r.emoji,
      value: r.spent,
      color: colorByKey.get(r.key) ?? T.text3,
    }))
    if (small.length > 0) {
      result.push({ key: '__other__', label: 'Other', emoji: '', value: small.reduce((s, r) => s + r.spent, 0), color: T.text3 })
    }
    return result
  }, [displayRows, colorByKey])

  const selectedRow = displayRows.find((r) => r.key === selectedKey) ?? null
  const donutSelectedKey =
    selectedKey == null ? null : segments.some((s) => s.key === selectedKey) ? selectedKey : '__other__'

  const sortedRows = useMemo(() => {
    if (sortBy === 'spend') return displayRows
    const withBudget = displayRows.filter((r) => !r.assignedIsCarried && r.assigned > 0)
    const withoutBudget = displayRows.filter((r) => r.assignedIsCarried || r.assigned <= 0)
    withBudget.sort((a, b) => b.spent / b.assigned - a.spent / a.assigned)
    return [...withBudget, ...withoutBudget]
  }, [displayRows, sortBy])

  const visibleRows = expanded ? sortedRows : sortedRows.slice(0, VISIBLE_ROWS)
  const collapsedCount = sortedRows.length - VISIBLE_ROWS
  const baseRows = mode === 'category' ? categoryRows : eligibleGroupRows
  const hasCustomFilter = baseRows.length - displayRows.length > 0
  const filterActiveCount = displayRows.length
  const filterRows = filterTab === 'category' ? categoryRows : eligibleGroupRows
  const draftKeys = filterTab === 'category' ? draftCategoryKeys : draftGroupKeys
  const allDraftSelected = filterRows.length > 0 && filterRows.every((r) => draftKeys?.has(r.key))
  const hasDraftVisibleCategory = categoryRows.some(
    (r) => draftCategoryKeys?.has(r.key) && draftGroupKeys?.has(groupFor(categoryGroupMap, r.key)),
  )

  // Applied only once the sheet has slid away, so the chart change is watched.
  useEffect(() => {
    if (filterOpen || pendingFilters == null) return
    const id = setTimeout(() => {
      setExcludedCategoryKeys(pendingFilters.categories)
      setExcludedGroupKeys(pendingFilters.groups)
      setPendingFilters(null)
      if (selectedKey == null) return
      const excluded =
        mode === 'category'
          ? pendingFilters.categories.has(selectedKey) || pendingFilters.groups.has(groupFor(categoryGroupMap, selectedKey))
          : pendingFilters.groups.has(selectedKey) ||
            categoryRows
              .filter((r) => groupFor(categoryGroupMap, r.key) === selectedKey)
              .every((r) => pendingFilters.categories.has(r.key))
      if (excluded) onSelectKey(null)
    }, FILTER_APPLY_DELAY_MS)
    return () => clearTimeout(id)
  }, [filterOpen, onSelectKey, pendingFilters, selectedKey, mode, categoryRows, categoryGroupMap])

  function openFilter() {
    setFilterTab(mode)
    setDraftCategoryKeys(new Set(categoryRows.filter((r) => !excludedCategoryKeys.has(r.key)).map((r) => r.key)))
    setDraftGroupKeys(new Set(eligibleGroupRows.filter((r) => !excludedGroupKeys.has(r.key)).map((r) => r.key)))
    setFilterOpen(true)
  }

  function closeFilter() {
    setFilterOpen(false)
    setDraftCategoryKeys(null)
    setDraftGroupKeys(null)
  }

  const setDraft = filterTab === 'category' ? setDraftCategoryKeys : setDraftGroupKeys

  function toggleDraftKey(key: string) {
    setDraft((current) => {
      const next = new Set(current ?? [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function applyFilter() {
    if (!hasDraftVisibleCategory) return
    const nextCategories = new Set<string>()
    const nextGroups = new Set<string>()
    for (const r of categoryRows) if (!draftCategoryKeys?.has(r.key)) nextCategories.add(r.key)
    for (const r of eligibleGroupRows) if (!draftGroupKeys?.has(r.key)) nextGroups.add(r.key)
    setPendingFilters({ categories: nextCategories, groups: nextGroups })
    const activeForTab = filterTab === 'category' ? nextCategories.size > 0 : nextGroups.size > 0
    if (activeForTab && mode !== filterTab) onModeChange(filterTab)
    closeFilter()
  }

  const toggleGroup: CSSProperties = { ...row, gap: 2, padding: 3, background: T.inputBg, borderRadius: radius.full }
  const cell = (on: boolean, extra?: CSSProperties): CSSProperties => ({
    ...pressable,
    borderRadius: radius.full,
    background: on ? T.chipActiveBg : 'transparent',
    color: T.text,
    ...extra,
  })
  const caption = (color: string, weight: keyof typeof font = 'bodyMedium', size: number = type.caption): CSSProperties => ({
    color,
    fontSize: size,
    ...font[weight],
  })

  let center: ReactNode
  if (selectedRow) {
    center = (
      <>
        {selectedRow.emoji ? <span style={{ fontSize: 22 }}>{selectedRow.emoji}</span> : null}
        <AmountText value={selectedRow.spent} size={type.body} weight="bodySemiBold" animate id="insights-donut-center" />
        <span style={caption(T.text2)}>{selectedRow.pct.toFixed(0)}%</span>
      </>
    )
  } else if (hasCustomFilter) {
    center = (
      <>
        <span style={caption(T.text2, 'bodyMedium', 11)}>Filtered total</span>
        <AmountText value={displayTotal} size={type.body} weight="bodySemiBold" animate id="insights-donut-center" />
      </>
    )
  } else if (displayRows[0]) {
    center = (
      <>
        {displayRows[0].emoji ? <span style={{ fontSize: 22 }}>{displayRows[0].emoji}</span> : null}
        <span style={caption(T.text, 'bodySemiBold', type.body)}>{displayRows[0].label}</span>
        <span style={caption(T.text2)}>{displayRows[0].pct.toFixed(0)}%</span>
      </>
    )
  }

  return (
    <div>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <span style={caption(T.text, 'displaySemiBold', type.bodyLg)}>Where it went</span>
        {baseRows.length > 1 && (
          <button
            type="button"
            aria-label={hasCustomFilter ? `Filter chart, ${filterActiveCount} active` : 'Filter chart'}
            onClick={openFilter}
            style={{
              ...pressable,
              ...row,
              justifyContent: 'center',
              gap: 6,
              minWidth: 38,
              height: 38,
              borderRadius: radius.full,
              border: `1px solid ${hasCustomFilter ? T.chipActiveBg : T.borderStrong}`,
              background: hasCustomFilter ? T.chipActiveBg : T.inputBg,
              paddingInline: hasCustomFilter ? 12 : 0,
            }}
          >
            <ListFilter size={18} color={T.text} />
            {hasCustomFilter ? <span style={caption(T.text, 'bodySemiBold')}>{filterActiveCount}</span> : null}
          </button>
        )}
      </div>

      <div style={{ ...row, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <div style={toggleGroup}>
          {(['category', 'group'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onModeChange(m)} style={cell(mode === m, { padding: '6px 10px' })}>
              <span style={caption(T.text, 'bodySemiBold')}>{m === 'category' ? 'By category' : 'By group'}</span>
            </button>
          ))}
        </div>
        <div style={{ ...toggleGroup, width: 64 }}>
          {(['spend', 'budget'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-label={m === 'spend' ? 'Measure by amount spent' : 'Measure by percent of budget used'}
              onClick={() => setSortBy(m)}
              style={cell(sortBy === m, { flex: 1, paddingBlock: 5, textAlign: 'center' })}
            >
              <span style={caption(T.text, 'bodyBold', type.body)}>{m === 'spend' ? '₹' : '%'}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ opacity: revealReady ? 1 : 0 }}>
        <div style={{ ...row, justifyContent: 'center', marginTop: 16 }}>
          <DonutChart key={revealKey} segments={segments} selectedKey={donutSelectedKey} onSelect={onSelectKey} revealKey={revealKey}>
            {play && (
              <PopIn
                key={`${revealKey}:${selectedKey ?? '__none__'}`}
                play
                delay={0}
                style={{ ...col, alignItems: 'center', width: 118, textAlign: 'center' }}
              >
                {center}
              </PopIn>
            )}
          </DonutChart>
        </div>

        <div style={{ ...col, marginTop: space.md, gap: space.sm }}>
          <AnimatePresence initial={false}>
            {visibleRows.map((r, i) => {
              const color = colorByKey.get(r.key) ?? T.text3
              const isSelected = selectedKey === r.key
              const hasBudget = !r.assignedIsCarried && r.assigned > 0
              const rowDelay = ROW_START_DELAY + Math.min(i, ROW_STAGGER_CAP) * ROW_STAGGER_MS
              return (
                <motion.div
                  key={r.key}
                  layout="position"
                  transition={LIST_SPRING}
                  exit={{ opacity: 0, transition: { duration: 0.16 } }}
                >
                  <PopIn key={`${revealKey}:${r.key}`} play={play} delay={rowDelay}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectKey(isSelected ? null : r.key)}
                      style={{ cursor: 'pointer', opacity: !isSelected && selectedKey != null ? 0.5 : 1, transition: 'opacity 160ms' }}
                    >
                      <div style={{ ...row, gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                        {r.emoji ? <span style={{ fontSize: 13 }}>{r.emoji}</span> : null}
                        <span style={{ ...caption(T.text), flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.label}
                        </span>
                        <span style={caption(T.text, 'bodySemiBold')}>{formatCurrency(r.spent)}</span>
                        {r.deltaPct != null && (
                          <span style={{ ...row, justifyContent: 'flex-end', width: 32, gap: 2 }}>
                            <Delta pct={r.deltaPct} size={8} textSize={10} />
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: space.xs }}>
                        {hasBudget ? (
                          <BudgetBar spent={r.spent} assigned={r.assigned} color={color} play={play} delay={rowDelay + BAR_OFFSET_MS} />
                        ) : (
                          <div style={{ height: 6, borderRadius: 100, background: T.borderStrong }} />
                        )}
                      </div>
                      <div style={{ ...caption(T.text3, 'bodyMedium', 11), marginTop: 6 }}>
                        {hasBudget ? `${formatCurrency(r.spent)} of ${formatCurrency(r.assigned)}` : 'No budget set'}
                      </div>
                      {isSelected && mode === 'category' && (
                        <button
                          type="button"
                          style={{ ...pressable, marginTop: 4 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            notice('Activity lives in the app.')
                          }}
                        >
                          <span style={caption(T.accentInk, 'bodySemiBold', 11)}>View transactions ›</span>
                        </button>
                      )}
                    </div>
                  </PopIn>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {!expanded && collapsedCount > 0 && (
            <button type="button" style={{ ...pressable, textAlign: 'left' }} onClick={() => setExpanded(true)}>
              <span style={caption(T.accentInk, 'bodySemiBold')}>Other ({collapsedCount})</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ ...row, justifyContent: 'space-between', borderTop: `0.5px solid ${T.border}`, marginTop: space.md, paddingTop: space.md }}>
        <span style={caption(T.text2)}>Income left in {monthLabel}</span>
        <span style={caption(T.text, 'bodySemiBold', type.body)}>{formatCurrency(leftover)}</span>
      </div>

      <BottomSheet visible={filterOpen} onClose={closeFilter}>
        <div style={{ ...row, gap: 16, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={caption(T.text, 'displaySemiBold', type.bodyLg)}>Filter chart</div>
            <div style={{ ...caption(T.text2), marginTop: 3 }}>Choose what appears in this chart</div>
          </div>
          <button
            type="button"
            style={pressable}
            onClick={() => setDraft(allDraftSelected ? new Set() : new Set(filterRows.map((r) => r.key)))}
          >
            <span style={caption(T.accent, 'bodySemiBold')}>{allDraftSelected ? 'Deselect all' : 'Select all'}</span>
          </button>
        </div>

        <div role="tablist" style={{ ...toggleGroup, marginBottom: 12 }}>
          {(
            [
              ['category', 'Categories'],
              ['group', 'Groups'],
            ] as const
          ).map(([tab, label]) => {
            const on = filterTab === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilterTab(tab)}
                style={cell(on, { flex: 1, textAlign: 'center', padding: '8px 10px' })}
              >
                <span style={caption(on ? T.text : T.text2, on ? 'bodySemiBold' : 'bodyMedium')}>{label}</span>
              </button>
            )
          })}
        </div>

        <div className="m-noscroll" style={{ maxHeight: 340, overflowY: 'auto', border: `0.5px solid ${T.border}`, borderRadius: 14 }}>
          {filterRows.map((r, index) => {
            const checked = draftKeys?.has(r.key) ?? false
            return (
              <button
                key={r.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleDraftKey(r.key)}
                style={{
                  ...pressable,
                  ...row,
                  width: '100%',
                  minHeight: 48,
                  gap: 8,
                  paddingInline: 12,
                  borderTop: index > 0 ? `0.5px solid ${T.border}` : 'none',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 4, background: colorByKey.get(r.key) ?? T.text3 }} />
                {r.emoji ? <span style={{ fontSize: 16 }}>{r.emoji}</span> : null}
                <span style={{ ...caption(T.text, 'bodyMedium', type.body), flex: 1, textAlign: 'left' }}>{r.label}</span>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    border: `1.5px solid ${checked ? T.accent : T.borderStrong}`,
                    background: checked ? T.accent : 'transparent',
                    ...row,
                    justifyContent: 'center',
                  }}
                >
                  {checked ? <Check size={14} color={T.onAccent} strokeWidth={3} /> : null}
                </span>
              </button>
            )
          })}
        </div>

        {!hasDraftVisibleCategory && (
          <div style={{ ...caption(T.coral, 'bodyMedium', 11), marginTop: 8 }}>Keep at least one item in the chart.</div>
        )}
        <div style={{ ...row, gap: 10, marginTop: 16 }}>
          <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={closeFilter} />
          <Button label="Apply" style={{ flex: 1, background: T.accent }} disabled={!hasDraftVisibleCategory} onPress={applyFilter} />
        </div>
      </BottomSheet>
    </div>
  )
}

// ─── DonutChart ──────────────────────────────────────────────────────────────

interface DonutSegment {
  key: string
  label: string
  emoji: string
  value: number
  color: string
}

interface DonutArcLayout {
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

function layoutDonutSegments(segments: DonutSegment[]): DonutArcLayout[] {
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
      style={{ x, y, cursor: arc.exiting ? 'default' : 'pointer' }}
      onClick={arc.exiting ? undefined : onPress}
    />
  )
}

/** Interactive donut whose segment changes morph in place. */
function DonutChart({
  segments,
  selectedKey,
  onSelect,
  revealKey,
  children,
}: {
  segments: DonutSegment[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
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

  if (!nextLayout.length) {
    return (
      <div style={{ ...col, width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: T.text3, ...font.bodyMedium, fontSize: 12 }}>No spending data yet</span>
      </div>
    )
  }

  const r = (SIZE - THICKNESS) / 2 - (LIFT + 2)
  return (
    <div style={{ width: SIZE, height: SIZE, position: 'relative' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
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
      <div style={{ position: 'absolute', inset: 0, ...col, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        {children}
      </div>
    </div>
  )
}
