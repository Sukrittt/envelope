'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useAppearance } from '@/components/AppearanceProvider'
import { ExpenseSidebar } from '@/src/components/ExpenseSidebar'
import { CategoryBreakdown } from '@/src/components/charts/CategoryBreakdown'
import { Heatmap, type HeatmapCell } from '@/src/components/charts/Heatmap'
import { TrendChart, type TrendPoint } from '@/src/components/charts/TrendChart'
import { useBudgets } from '@/src/hooks/useBudgets'
import { useCategories } from '@/src/hooks/useCategories'
import { useExpenses } from '@/src/hooks/useExpenses'
import { useGroups } from '@/src/hooks/useGroups'
import { useHideAmounts } from '@/src/hooks/useHideAmounts'
import { currentMonthKey, monthAbbrev, monthLabel, prevMonthKey, shiftMonthKey } from '@/src/lib/envelope'
import { todayIST } from '@/src/lib/date'
import { formatDateShort } from '@/src/lib/format'
import { categoryBreakdown, leftoverFor, monthComparison, monthTotals, withDelta } from '@/src/lib/monthly'
import { computeEnvelopeState } from '@/src/lib/envelope'
import { EMPTY } from '@/src/lib/constants'
import { formatCurrency } from '@/lib/currency'

const TREND_MONTHS = 12
const HEATMAP_WEEKS = 12

function money(value: number, hidden: boolean) {
  return hidden ? '₹••••' : formatCurrency(value)
}

function monthsBack(month: string, currentMonth: string) {
  const [y1, m1] = month.split('-').map(Number)
  const [y2, m2] = currentMonth.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1)
}

export function InsightsPage() {
  const router = useRouter()
  const { theme, setTheme } = useAppearance()
  const [hideAmounts] = useHideAmounts()
  const budgetsQuery = useBudgets()
  const expensesQuery = useExpenses()
  const categoriesQuery = useCategories()
  const groupsQuery = useGroups()

  const budgets = budgetsQuery.data ?? EMPTY
  const expenses = expensesQuery.data ?? EMPTY
  const categories = categoriesQuery.data ?? EMPTY
  const groups = groupsQuery.data ?? EMPTY
  const currentMonth = currentMonthKey()
  const today = todayIST()

  const [insightMonth, setInsightMonth] = useState(currentMonth)
  const [breakdownMode, setBreakdownMode] = useState<'category' | 'group'>('category')
  const [selectedBreakdownKey, setSelectedBreakdownKey] = useState<string | null>(null)
  const [heatmapView, setHeatmapView] = useState<'month' | 'weeks'>('month')

  const scopeRef = useRef(`${insightMonth}|${breakdownMode}`)
  const scope = `${insightMonth}|${breakdownMode}`
  if (scopeRef.current !== scope) {
    scopeRef.current = scope
    if (selectedBreakdownKey != null) setSelectedBreakdownKey(null)
  }

  const loading = budgetsQuery.isLoading || expensesQuery.isLoading || categoriesQuery.isLoading || groupsQuery.isLoading
  const earliestMonth = useMemo(() => {
    if (expenses.length === 0) return currentMonth
    return expenses.reduce((earliest, expense) => expense.date.slice(0, 7) < earliest ? expense.date.slice(0, 7) : earliest, currentMonth)
  }, [expenses, currentMonth])

  const currentState = useMemo(
    () => computeEnvelopeState(budgets, expenses, currentMonth, categories, groups),
    [budgets, expenses, categories, groups, currentMonth],
  )
  const categoryGroupMap = useMemo(() => new Map(categories.map((category) => [category.name, category.group || 'Other'])), [categories])

  const trendMonths = useMemo(
    () => Array.from({ length: TREND_MONTHS }, (_, index) => shiftMonthKey(currentMonth, index - (TREND_MONTHS - 1))),
    [currentMonth],
  )
  const trendData: TrendPoint[] = useMemo(() => {
    const totals = monthTotals(expenses, trendMonths)
    return trendMonths.map((date) => ({ date, value: totals.get(date) ?? 0 })).filter((point) => point.value > 0)
  }, [expenses, trendMonths])

  const comparison = useMemo(() => monthComparison(expenses, insightMonth, today), [expenses, insightMonth, today])
  const categoryRows = useMemo(() => withDelta(
    categoryBreakdown(budgets, expenses, categories, groups, insightMonth, 'category'),
    categoryBreakdown(budgets, expenses, categories, groups, prevMonthKey(insightMonth), 'category'),
  ), [budgets, expenses, categories, groups, insightMonth])
  const groupRows = useMemo(() => withDelta(
    categoryBreakdown(budgets, expenses, categories, groups, insightMonth, 'group'),
    categoryBreakdown(budgets, expenses, categories, groups, prevMonthKey(insightMonth), 'group'),
  ), [budgets, expenses, categories, groups, insightMonth])
  const breakdownRows = breakdownMode === 'category' ? categoryRows : groupRows
  const leftover = useMemo(() => leftoverFor(budgets, expenses, categories, groups, insightMonth), [budgets, expenses, categories, groups, insightMonth])

  const trendSummary = useMemo(() => {
    if (trendData.length >= 3) return null
    if (trendData.length <= 1) return { kind: 'first' as const }
    const previous = prevMonthKey(insightMonth)
    const totals = monthTotals(expenses, [insightMonth, previous])
    const current = totals.get(insightMonth) ?? 0
    const prior = totals.get(previous) ?? 0
    return { kind: 'compare' as const, current, prior, previous, deltaPct: prior > 0 ? ((current - prior) / prior) * 100 : null }
  }, [trendData.length, expenses, insightMonth])

  function matchesSelection(category: string) {
    if (!selectedBreakdownKey) return true
    if (breakdownMode === 'category') return category === selectedBreakdownKey
    return (categoryGroupMap.get(category) || 'Other') === selectedBreakdownKey
  }

  const heatmap = useMemo(() => {
    const totals = new Map<string, number>()
    if (heatmapView === 'month') {
      for (const expense of expenses) {
        if (!expense.date.startsWith(insightMonth) || !matchesSelection(expense.category)) continue
        totals.set(expense.date, (totals.get(expense.date) ?? 0) + (Number(expense.amount_inr) || 0))
      }
      const [year, month] = insightMonth.split('-').map(Number)
      const daysInMonth = new Date(year, month, 0).getDate()
      const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
      const cells: HeatmapCell[] = Array.from({ length: firstWeekday }, (_, index) => ({ date: `pad-${index}`, day: 0, value: 0 }))
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${insightMonth}-${String(day).padStart(2, '0')}`
        cells.push({ date, day, value: totals.get(date) ?? 0 })
      }
      return { cells, caption: null as string | null }
    }

    const [year, month, day] = today.split('-').map(Number)
    const end = new Date(year, month - 1, day)
    const start = new Date(end)
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1))
    const days: Array<{ date: string; day: number }> = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      days.push({ date, day: cursor.getDate() })
      cursor.setDate(cursor.getDate() + 1)
    }
    const startDate = days[0]?.date ?? today
    for (const expense of expenses) {
      if (expense.date < startDate || expense.date > today || !matchesSelection(expense.category)) continue
      totals.set(expense.date, (totals.get(expense.date) ?? 0) + (Number(expense.amount_inr) || 0))
    }
    const firstWeekday = (start.getDay() + 6) % 7
    return {
      cells: [
        ...Array.from({ length: firstWeekday }, (_, index) => ({ date: `pad-${index}`, day: 0, value: 0 })),
        ...days.map((entry) => ({ ...entry, value: totals.get(entry.date) ?? 0 })),
      ],
      caption: `${formatDateShort(startDate)} – ${formatDateShort(today)}`,
    }
  // matchesSelection closes over the selection and category mapping listed below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, insightMonth, heatmapView, today, selectedBreakdownKey, breakdownMode, categoryGroupMap])

  const selectedRow = breakdownRows.find((row) => row.key === selectedBreakdownKey) ?? null
  const back = monthsBack(insightMonth, currentMonth)
  const canGoPrevious = insightMonth > earliestMonth
  const canGoNext = insightMonth < currentMonth
  const isCurrent = insightMonth === currentMonth

  return (
    <section className="expense-redesign insights-page">
      <button type="button" className="erd-theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <header className="erd-mobile-header ins-mobile-header">
        <button type="button" className="ins-back-btn" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={18} /></button>
        <div><div className="erd-mobile-greet">{monthLabel(insightMonth)}</div><span>{isCurrent ? 'This month' : `${back} ${back === 1 ? 'month' : 'months'} back`}</span></div>
      </header>

      <div className="erd-main">
        <ExpenseSidebar month={currentMonth} income={currentState.income} totalSpent={currentState.totalSpent} />
        <main className="erd-content ins-content">
          <header className="ins-period-header">
            <button type="button" className="ins-back-btn ins-desktop-back" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={18} /></button>
            <div className="ins-period-copy">
              <span className="ins-kicker">Your spending story</span>
              <h1>{monthLabel(insightMonth)}</h1>
              {!isCurrent && <button type="button" className="ins-today-chip" onClick={() => setInsightMonth(currentMonth)}>↩ Today</button>}
            </div>
            <div className="ins-month-controls">
              <button type="button" onClick={() => canGoPrevious && setInsightMonth((month) => shiftMonthKey(month, -1))} disabled={!canGoPrevious} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <span>{isCurrent ? 'This month' : `${back} ${back === 1 ? 'month' : 'months'} back`}</span>
              <button type="button" onClick={() => canGoNext && setInsightMonth((month) => shiftMonthKey(month, 1))} disabled={!canGoNext} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>
          </header>

          {loading ? (
            <div className="insights-grid" aria-label="Loading insights">
              {[0, 1, 2].map((key) => <div key={key} className="erd-card ins-skeleton-card"><i /><i /><i /></div>)}
            </div>
          ) : (
            <div className="insights-grid">
              <article className="erd-card ins-card ins-trend-card">
                <div className="ins-card-heading">
                  <div><h2>Spending trend</h2><p>Last 12 months</p></div>
                  {trendSummary?.kind === 'compare' && trendSummary.deltaPct != null && (
                    <span className={trendSummary.deltaPct > 0 ? 'ins-head-delta is-up' : 'ins-head-delta is-down'}>
                      {trendSummary.deltaPct > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {Math.abs(trendSummary.deltaPct).toFixed(0)}%
                    </span>
                  )}
                </div>
                {trendSummary ? (
                  <p className="ins-trend-summary">
                    {trendSummary.kind === 'first' ? 'First month tracked.' : <><strong>{money(trendSummary.current, hideAmounts)}</strong> in {monthLabel(insightMonth)} vs {money(trendSummary.prior, hideAmounts)} in {monthLabel(trendSummary.previous)}</>}
                  </p>
                ) : (
                  <TrendChart data={trendData} baseline={comparison.baseline} selectedKey={insightMonth} hideAmounts={hideAmounts} onSelect={setInsightMonth} partialKey={currentMonth} partialNote={`${monthAbbrev(currentMonth)}, ${Number(today.slice(8, 10))} days in`} />
                )}
              </article>

              <article className="erd-card ins-card ins-breakdown-card">
                <CategoryBreakdown key={`${insightMonth}|${breakdownMode}`} rows={breakdownRows} mode={breakdownMode} onModeChange={setBreakdownMode} selectedKey={selectedBreakdownKey} onSelectKey={setSelectedBreakdownKey} comparison={comparison} leftover={leftover} monthLabel={monthLabel(insightMonth)} hideAmounts={hideAmounts} />
              </article>

              <article className="erd-card ins-card ins-heatmap-card">
                <div className="ins-card-heading ins-heatmap-heading">
                  <div><h2>{selectedRow ? `Daily spend · ${selectedRow.label}` : 'Daily spend'}</h2>{heatmap.caption && <p>{heatmap.caption}</p>}</div>
                  <div className="ins-segmented" aria-label="Heatmap range">
                    <button type="button" className={heatmapView === 'month' ? 'is-active' : ''} onClick={() => setHeatmapView('month')}>Month</button>
                    <button type="button" className={heatmapView === 'weeks' ? 'is-active' : ''} onClick={() => setHeatmapView('weeks')}>12 weeks</button>
                  </div>
                </div>
                <Heatmap cells={heatmap.cells} todayDate={today} hideAmounts={hideAmounts} onSelectDate={(date) => router.push(`/expense/transactions?date=${date}`)} />
              </article>
            </div>
          )}
        </main>
      </div>

      <nav className="erd-tabbar" aria-label="Primary">
        <Link href="/expense" className="erd-tab"><span aria-hidden="true">🏠</span><span>Home</span></Link>
        <Link href="/expense/transactions" className="erd-tab"><span aria-hidden="true">🧾</span><span>Activity</span></Link>
        <Link href="/insights" className="erd-tab is-active"><span aria-hidden="true">📊</span><span>Insights</span></Link>
        <Link href="/account" className="erd-tab"><span aria-hidden="true">⚙️</span><span>More</span></Link>
      </nav>
    </section>
  )
}
