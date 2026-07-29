import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SparkBars } from '../components/SparkBars'
import { ReadyToAssignBanner } from '../components/ReadyToAssignBanner'
import { EnvelopeGrid } from '../components/EnvelopeGrid'
import { MoveMoneyModal } from '../components/MoveMoneyModal'
import { ExpenseSidebar } from '../components/ExpenseSidebar'
import { toExpensePanelData, type ExpensePanelData } from '../services/expensePanelAdapter'
import { loadExpensePanelContract } from '../services/expensePanelLoader'
import type { EnvelopeState } from '../types/expense'

type PeriodKey = '7d' | '30d' | 'mtd' | 'custom'
type TrendView = 'daily' | 'weekly' | 'monthly'
type DrillFilter = { start: string; end: string; parentView: TrendView } | null

function formatLastUpdated(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Updated recently'

  const mins = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
  if (mins < 60) return `Updated ${mins}m ago`

  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `Updated ${hrs}h ago`

  return `Updated ${Math.round(hrs / 24)}d ago`
}

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function weekKey(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  const start = new Date(date)
  const diffToMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - diffToMonday)
  return start.toISOString().slice(0, 10)
}

function monthKey(input: string): string {
  return input.slice(0, 7)
}

function monthRangeFromKey(key: string): { start: string; end: string } {
  const d = new Date(`${key}-01`)
  const start = d.toISOString().slice(0, 10)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

function weekRangeFromKey(startIso: string): { start: string; end: string } {
  const d = new Date(startIso)
  const end = new Date(d)
  end.setDate(d.getDate() + 6)
  return { start: d.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function weekRangeLabel(startIso: string): string {
  const start = new Date(startIso)
  if (Number.isNaN(start.getTime())) return startIso
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}-${end.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })}`
}

// type ExpenseTab = 'overview' | 'transactions' | 'insights'

export function ExpensePage() {
  const [panel, setPanel] = useState<ExpensePanelData | null>(null)
  // const [activeTab, setActiveTab] = useState<ExpenseTab>('overview')
  const [period, setPeriod] = useState<PeriodKey>('mtd')
  const [trendView, setTrendView] = useState<TrendView>('daily')
  const [drillFilter, setDrillFilter] = useState<DrillFilter>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
  const [categoryMenuPosition, setCategoryMenuPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null)
  const [hideAmounts] = useState<boolean>(() => {
    const stored = localStorage.getItem('expense-hide-amounts')
    return stored === 'true'
  })
  const [dailyDetailDate, setDailyDetailDate] = useState<string | null>(null)
  const [envelopeState, setEnvelopeState] = useState<EnvelopeState | null>(null)
  const [moveMoneyTarget, setMoveMoneyTarget] = useState<string | null>(null)

  function handleIncomeChange(newIncome: number) {
    setEnvelopeState((prev) => {
      if (!prev) return prev
      const totalAssigned = prev.envelopes.reduce((s, e) => s + e.assigned, 0)
      const rta = newIncome - totalAssigned
      return { ...prev, income: newIncome, readyToAssign: rta, isOverAssigned: rta < 0 }
    })
    localStorage.setItem('expense-income-override', String(newIncome))
  }

  const categoryMenuRef = useRef<HTMLDivElement | null>(null)
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    loadExpensePanelContract().then((contract) => {
      const data = toExpensePanelData(contract)
      setPanel(data)
      setEnvelopeState(data.envelopeState)
    })
  }, [])

  const latestDate = useMemo(() => {
    if (!panel) return new Date()
    const last = panel.miniTrend.at(-1)?.date ?? panel.month
    const date = new Date(last)
    return Number.isNaN(date.getTime()) ? new Date() : date
  }, [panel])

  const [customStart, setCustomStart] = useState<string>(toDateInputValue(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)))
  const [customEnd, setCustomEnd] = useState<string>(toDateInputValue(latestDate))

  const categoryOptions = useMemo(() => panel?.topCategories.map((category) => category.category) ?? [], [panel])
  const allCategoriesSelected = selectedCategories.length === 0

  function selectAllCategories() {
    setSelectedCategories([])
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]))
  }

  function formatCurrencyHidden(value: number): React.ReactNode {
    if (hideAmounts) {
      return <span className="currency-hidden">--</span>
    }
    return formatCurrency(value)
  }

  useEffect(() => {
    if (!isCategoryMenuOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (categoryMenuRef.current?.contains(target) || categoryTriggerRef.current?.contains(target)) {
        return
      }
      setIsCategoryMenuOpen(false)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsCategoryMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isCategoryMenuOpen])

  useEffect(() => {
    if (!isCategoryMenuOpen) return

    function updatePosition() {
      const rect = categoryTriggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const horizontalPadding = 16
      const minWidth = rect.width
      const left = Math.max(horizontalPadding, rect.right - Math.max(minWidth, 270))
      setCategoryMenuPosition({
        top: rect.bottom + 6,
        left,
        minWidth,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isCategoryMenuOpen])

  const filteredTrend = useMemo(() => {
    if (!panel) return []
    const rows = [...panel.miniTrend]
    const end = new Date(latestDate)
    let start = new Date(rows[0]?.date ?? end)

    if (period === '7d') {
      start = new Date(end)
      start.setDate(end.getDate() - 6)
    } else if (period === '30d') {
      start = new Date(end)
      start.setDate(end.getDate() - 29)
    } else if (period === 'mtd') {
      start = new Date(end.getFullYear(), end.getMonth(), 1)
    } else {
      const parsedStart = new Date(customStart)
      const parsedEnd = new Date(customEnd)
      if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
        start = parsedStart
        if (parsedEnd.getTime() < end.getTime()) {
          end.setTime(parsedEnd.getTime())
        }
      }
    }

    return rows.filter((row) => {
      const date = new Date(row.date)
      return !Number.isNaN(date.getTime()) && date >= start && date <= end
    })
  }, [customEnd, customStart, latestDate, panel, period])

  const categoryScopeRatio = useMemo(() => {
    if (!panel || !selectedCategories.length) return 1
    const catTotal = panel.topCategories.reduce((s, r) => s + r.amountInr, 0)
    if (!catTotal) return 1
    const selTotal = panel.topCategories
      .filter((row) => selectedCategories.includes(row.category))
      .reduce((s, r) => s + r.amountInr, 0)
    return selTotal / catTotal
  }, [panel, selectedCategories])

  const dailyCategoryMap = useMemo(() => {
    if (!panel) return new Map<string, Record<string, number>>()
    const map = new Map<string, Record<string, number>>()
    for (const row of panel.expenseRows) {
      const prev = map.get(row.date) ?? {}
      prev[row.category] = (prev[row.category] ?? 0) + row.amountInr
      map.set(row.date, prev)
    }
    return map
  }, [panel])

  const trendSeries = useMemo(() => {
    const useFullHistory = trendView === 'monthly' || (drillFilter?.parentView === 'monthly')
    const baseRows = useFullHistory && panel ? panel.miniTrend : filteredTrend
    let source = baseRows.map((row) => ({ ...row, value: row.value * categoryScopeRatio }))

    if (drillFilter) {
      source = source.filter((row) => row.date >= drillFilter.start && row.date <= drillFilter.end)
    }

    if (trendView === 'daily') {
      if (!drillFilter && (period === '7d' || period === '30d')) {
        const now = new Date()
        const today = now.toISOString().slice(0, 10)
        const startOfWeek = new Date(now)
        const diffToMonday = (startOfWeek.getDay() + 6) % 7
        startOfWeek.setDate(now.getDate() - diffToMonday)
        const weekStart = startOfWeek.toISOString().slice(0, 10)
        source = source.filter((row) => row.date >= weekStart && row.date <= today)
      }

      const byDate = new Map(source.map((row) => [row.date, row.value]))
      const startIso = drillFilter ? drillFilter.start : source[0]?.date
      const endIso = drillFilter ? drillFilter.end : source[source.length - 1]?.date
      if (!startIso || !endIso) return source.map((row) => ({ date: row.date, value: row.value }))

      const out: { date: string; value: number; categories?: Record<string, number> }[] = []
      const cursor = new Date(startIso)
      const end = new Date(endIso)
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10)
        const rawCats = dailyCategoryMap.get(key)
        const categories = rawCats && allCategoriesSelected
          ? rawCats
          : rawCats && selectedCategories.length > 0
            ? Object.fromEntries(
                Object.entries(rawCats).filter(([cat]) => selectedCategories.includes(cat))
              )
            : undefined
        out.push({ date: key, value: byDate.get(key) ?? 0, categories })
        cursor.setDate(cursor.getDate() + 1)
      }
      return out
    }

    if (trendView === 'weekly') {
      const byWeek = new Map<string, number>()
      source.forEach((row) => {
        const key = weekKey(row.date)
        byWeek.set(key, (byWeek.get(key) ?? 0) + row.value)
      })

      return [...byWeek.entries()].map(([date, value]) => ({ date: weekRangeLabel(date), value }))
    }

    const byMonth = new Map<string, number>()
    source.forEach((row) => {
      const key = row.date.slice(0, 7)
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.value)
    })

    return [...byMonth.entries()].map(([date, value]) => ({
      date,
      value,
    }))
  }, [categoryScopeRatio, allCategoriesSelected, dailyCategoryMap, drillFilter, filteredTrend, trendView, panel, selectedCategories])

  const trendKeys = useMemo(() => {
    const useFullHistory = trendView === 'monthly' || (drillFilter?.parentView === 'monthly')
    let source = useFullHistory && panel ? panel.miniTrend : filteredTrend
    if (drillFilter) {
      source = source.filter((row) => row.date >= drillFilter.start && row.date <= drillFilter.end)
    }
    if (trendView === 'daily') return source.map((row) => row.date)
    if (trendView === 'weekly') {
      const keys: string[] = []
      const seen = new Set<string>()
      source.forEach((row) => {
        const k = weekKey(row.date)
        if (!seen.has(k)) { seen.add(k); keys.push(k) }
      })
      return keys
    }
    const keys: string[] = []
    const seen = new Set<string>()
    source.forEach((row) => {
      const k = monthKey(row.date)
      if (!seen.has(k)) { seen.add(k); keys.push(k) }
    })
    return keys
  }, [drillFilter, filteredTrend, trendView, panel])

  function handleBarClick(index: number) {
    if (trendView === 'monthly') {
      const key = trendKeys[index]
      if (!key) return
      const range = monthRangeFromKey(key)
      setDrillFilter({ ...range, parentView: 'monthly' })
      setTrendView('weekly')
    } else if (trendView === 'weekly') {
      const key = trendKeys[index]
      if (!key) return
      const range = weekRangeFromKey(key)
      setDrillFilter({ ...range, parentView: 'weekly' })
      setTrendView('daily')
    }
  }

  function handleDrillBack() {
    if (drillFilter) {
      setTrendView(drillFilter.parentView)
      setDrillFilter(null)
    }
  }

  function handleDailyBarClick(index: number) {
    const entry = trendSeries[index]
    if (!entry) return
    setDailyDetailDate(entry.date)
  }

  const dailyDetailRows = useMemo(() => {
    if (!dailyDetailDate || !panel) return []
    return panel.expenseRows
      .filter((row) => row.date === dailyDetailDate)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }, [dailyDetailDate, panel])

  const dailyDetailTotal = useMemo(() => dailyDetailRows.reduce((sum, row) => sum + row.amountInr, 0), [dailyDetailRows])

  useEffect(() => {
    if (!dailyDetailDate) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDailyDetailDate(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [dailyDetailDate])

  const stalenessText = panel ? formatLastUpdated(panel.lastUpdated) : 'Loading…'
  const categoryScopeLabel = selectedCategories.length ? `${selectedCategories.length} selected` : 'All categories'

  if (!panel) {
    return (
      <section className="expense-view" aria-busy="true" aria-live="polite">
        <div className="expense-layout">
          <nav className="expense-sidebar">
            <div className="expense-sidebar-brand">Expenses</div>
            <div className="expense-sidebar-group">
              <div className="expense-sidebar-group-label">General</div>
              <div className="expense-sidebar-link is-active">
                <span className="expense-sidebar-link-icon">◆</span>
                Overview
              </div>
            </div>
          </nav>
          <div className="expense-main">
            <section className="headline">
              <div>
                <h1>Expense Command Center</h1>
                <p className="muted">Loading latest transactions…</p>
              </div>
            </section>

            <section className="mc-kpi-strip" aria-hidden="true">
              <article className="mc-kpi-card expense-skeleton-card">
                <span className="expense-skeleton expense-skeleton-line short" />
                <span className="expense-skeleton expense-skeleton-line" />
                <span className="expense-skeleton expense-skeleton-line medium" />
              </article>
              <article className="mc-kpi-card expense-skeleton-card">
                <span className="expense-skeleton expense-skeleton-line short" />
                <span className="expense-skeleton expense-skeleton-line" />
                <span className="expense-skeleton expense-skeleton-line medium" />
              </article>
              <article className="mc-kpi-card expense-skeleton-card">
                <span className="expense-skeleton expense-skeleton-line short" />
                <span className="expense-skeleton expense-skeleton-line" />
                <span className="expense-skeleton expense-skeleton-line medium" />
              </article>
            </section>

            <section className="mc-main-panels" aria-hidden="true">
              <article className="mc-panel expense-skeleton-panel">
                <span className="expense-skeleton expense-skeleton-line medium" />
                <span className="expense-skeleton expense-skeleton-block" />
              </article>
              <article className="mc-panel expense-skeleton-panel">
                <span className="expense-skeleton expense-skeleton-line medium" />
                <span className="expense-skeleton expense-skeleton-block" />
              </article>
            </section>
          </div>
        </div>
      </section>
    )
  }

  const isCategoryMenuVisible = Boolean(isCategoryMenuOpen && categoryMenuPosition)
  const menuPosition =
    categoryMenuPosition ??
    ({
      top: 0,
      left: 0,
      minWidth: 140,
    } as const)

  const categoryMenu = createPortal(
    <div
      className="category-menu category-menu--portal"
      role="menu"
      aria-label="Category filter menu"
      aria-hidden={!isCategoryMenuVisible}
      ref={categoryMenuRef}
      style={{
        position: 'fixed',
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        minWidth: `${menuPosition.minWidth}px`,
        display: isCategoryMenuVisible ? 'grid' : 'none',
        pointerEvents: isCategoryMenuVisible ? 'auto' : 'none',
      }}
    >
      <div className="category-menu-list">
        <button
          type="button"
          className={`action-button is-ghost category-option category-option--all ${allCategoriesSelected ? 'is-selected' : ''}`}
          onClick={selectAllCategories}
        >
          <input type="checkbox" readOnly checked={allCategoriesSelected} tabIndex={-1} aria-hidden="true" />
          All categories
        </button>

        {categoryOptions.map((category) => {
          const isSelected = selectedCategories.includes(category)
          return (
            <button
              type="button"
              key={category}
              className={`action-button is-ghost category-option ${isSelected ? 'is-selected' : ''}`}
              onClick={() => toggleCategory(category)}
            >
              <input type="checkbox" readOnly checked={isSelected} tabIndex={-1} aria-hidden="true" />
              {category}
            </button>
          )
        })}
      </div>

      {!allCategoriesSelected ? (
        <div className="category-menu-actions">
          <button type="button" className="action-button is-ghost" onClick={selectAllCategories}>
            Clear category filters
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  )

  function handleSidebarMoveMoney() {
    const firstOverspent = envelopeState?.envelopes.find((e) => e.isOverspent)
    if (firstOverspent) setMoveMoneyTarget(firstOverspent.category)
  }

  function handleShowCategories() {
    const el = document.querySelector('.expense-envelope-panel')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="expense-view">
      <div className="expense-layout">
        <ExpenseSidebar
          onMoveMoney={handleSidebarMoveMoney}
          onShowCategories={handleShowCategories}
          month={panel.month}
          income={envelopeState?.income}
          totalSpent={envelopeState?.totalSpent}
        />
        <div className="expense-main">

      <div className="expense-tab-content">
      {envelopeState && (
        <ReadyToAssignBanner
          income={envelopeState.income}
          totalAssigned={envelopeState.totalAssigned}
          readyToAssign={envelopeState.readyToAssign}
          isOverAssigned={envelopeState.isOverAssigned}
          onIncomeChange={handleIncomeChange}
          sparkData={panel.miniTrend.slice(-7)}
        />
      )}

      <section className="mc-filterbar expense-scopebar" aria-label="Scope bar">
        <div className="scope-group" role="group" aria-label="Period selector">
          <div className="mc-filter-chips" role="tablist" aria-label="Period presets">
            <button type="button" className={`action-button ${period === '7d' ? 'is-active' : ''}`} onClick={() => setPeriod('7d')}>
              Last 7 days
            </button>
            <button type="button" className={`action-button ${period === '30d' ? 'is-active' : ''}`} onClick={() => setPeriod('30d')}>
              Last 30 days
            </button>
            <button type="button" className={`action-button ${period === 'mtd' ? 'is-active' : ''}`} onClick={() => setPeriod('mtd')}>
              Month to date
            </button>
            <button type="button" className={`action-button ${period === 'custom' ? 'is-active' : ''}`} onClick={() => setPeriod('custom')}>
              Custom range
            </button>
          </div>
        </div>

        {period === 'custom' ? (
          <div className="scope-group custom-dates">
            <label>
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Custom start date" />
            </label>
            <label>
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Custom end date" />
            </label>
          </div>
        ) : null}

        <div className="scope-meta-inline" aria-label="Scope status">
          <span>{stalenessText}</span>
          <span className="scope-inline-category">
            <div className="category-dropdown category-dropdown--inline">
              <button
                type="button"
                className="action-button category-trigger"
                onClick={() => setIsCategoryMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isCategoryMenuOpen}
                ref={categoryTriggerRef}
              >
                <span>{categoryScopeLabel}</span>
                <span aria-hidden="true">▾</span>
              </button>
            </div>
          </span>
        </div>
      </section>

      <section className="expense-grid-xman">
        <article className="mc-panel expense-trend-panel">
          <div className="mc-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {drillFilter && (
                <button type="button" className="action-button is-ghost" onClick={handleDrillBack}>
                  ← Back
                </button>
              )}
              <h3>Spending trend</h3>
            </div>
            <div className="segmented-control trend-toggle">
              <button type="button" className={`action-button ${trendView === 'daily' ? 'is-active' : ''}`} onClick={() => { setTrendView('daily'); setDrillFilter(null) }}>
                Daily
              </button>
              <button type="button" className={`action-button ${trendView === 'weekly' ? 'is-active' : ''}`} onClick={() => { setTrendView('weekly'); setDrillFilter(null) }}>
                Weekly
              </button>
              <button type="button" className={`action-button ${trendView === 'monthly' ? 'is-active' : ''}`} onClick={() => { setTrendView('monthly'); setDrillFilter(null) }}>
                Monthly
              </button>
            </div>
          </div>
          <SparkBars
            data={trendSeries}
            size="expanded"
            formatValue={(value) => hideAmounts ? '---' : formatCurrency(value)}
            capOutliers
            onBarClick={trendView === 'daily' ? handleDailyBarClick : handleBarClick}
          />
          {dailyDetailDate && createPortal(
            <div className="daily-detail-overlay" onClick={() => setDailyDetailDate(null)}>
              <div className="daily-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="daily-detail-header">
                  <h4>{new Date(dailyDetailDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                  <button type="button" className="daily-detail-close" onClick={() => setDailyDetailDate(null)} aria-label="Close">✕</button>
                </div>
                {dailyDetailRows.length === 0 ? (
                  <p className="daily-detail-empty">No transactions recorded for this day.</p>
                ) : (
                  <>
                    <table className="daily-detail-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Item</th>
                          <th>Category</th>
                          <th className="num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyDetailRows.map((row, i) => {
                          const time = row.timestamp ? new Date(row.timestamp) : null
                          const timeStr = time && !Number.isNaN(time.getTime())
                            ? time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : '—'
                          return (
                            <tr key={`${row.timestamp}-${i}`}>
                              <td className="daily-detail-time">{timeStr}</td>
                              <td>{row.item}</td>
                              <td><span className="daily-detail-category">{row.category}</span></td>
                              <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{hideAmounts ? '---' : formatCurrency(row.amountInr)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="daily-detail-footer">
                      <span>Total</span>
                      <span className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{hideAmounts ? '---' : formatCurrency(dailyDetailTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>,
            document.body
          )}
        </article>

        <article className="mc-panel expense-envelope-panel">
          <div className="mc-panel-header">
            <h3>Envelopes</h3>
            <p>Assigned · Spent · Available</p>
          </div>
          {envelopeState && (
            <EnvelopeGrid
              envelopes={envelopeState.envelopes}
              hideAmounts={hideAmounts}
              onMoveMoney={(cat) => setMoveMoneyTarget(cat)}
            />
          )}
        </article>

        <article className="mc-panel expense-subscriptions-panel">
          <div className="mc-panel-header">
            <h3>Subscriptions</h3>
            <p>Recurring drag</p>
          </div>
          {(() => {
            const monthlyTotal = panel.subscriptions.active.reduce((sum, sub) => {
              if (/yearly|annual/i.test(sub.billingCycle)) return sum + sub.amountInr / 12
              if (/quarterly/i.test(sub.billingCycle)) return sum + sub.amountInr / 3
              if (/weekly/i.test(sub.billingCycle)) return sum + sub.amountInr * 4.33
              return sum + sub.amountInr
            }, 0)
            return (
              <p className={`subscription-amount ${hideAmounts ? 'amount-hidden' : ''}`}>
                {hideAmounts ? '---' : `~${formatCurrency(Math.round(monthlyTotal))}/mo`}
              </p>
            )
          })()}

          <div className="subscription-lists">
            <details className="subscription-accordion" open>
              <summary>
                <h4>Active ({panel.subscriptions.active.length})</h4>
                <span className="chevron" aria-hidden="true">▾</span>
              </summary>
              <ul className="compact-bullets compact-bullets--tight">
                {panel.subscriptions.active.map((sub) => (
                  <li key={`${sub.service}-${sub.status}`}>
                    <strong>{sub.service}</strong> · {sub.billingCycle} · {formatCurrencyHidden(sub.amountInr)}
                  </li>
                ))}
              </ul>
            </details>

            <details className="subscription-accordion">
              <summary>
                <h4>Cancelled ({panel.subscriptions.cancelled.length})</h4>
                <span className="chevron" aria-hidden="true">▾</span>
              </summary>
              {panel.subscriptions.cancelled.length ? (
                <ul className="compact-bullets compact-bullets--tight">
                  {panel.subscriptions.cancelled.map((sub) => (
                    <li key={`${sub.service}-${sub.status}`}>
                      <strong>{sub.service}</strong> · {sub.status} · {sub.renewalOrEndMonth ?? 'n/a'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No cancelled subscriptions found.</p>
              )}
            </details>
          </div>
        </article>
      </section>

      <div className="tags">
        {panel.deepLinks.map((link) => (
          <a key={link.label} className="inline-link" href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      </div>
      {moveMoneyTarget && envelopeState && (
        <MoveMoneyModal
          targetCategory={moveMoneyTarget}
          envelopes={envelopeState.envelopes}
          onClose={() => setMoveMoneyTarget(null)}
          onTransfer={(from, to, amount) => {
            setEnvelopeState((prev) => {
              if (!prev) return prev
              const updated = prev.envelopes.map((e) => {
                if (e.category === from) return { ...e, assigned: e.assigned - amount, available: e.available - amount }
                if (e.category === to) return { ...e, assigned: e.assigned + amount, available: e.available + amount }
                return e
              })
              const totalAssigned = updated.reduce((s, e) => s + e.assigned, 0)
              const rta = prev.income - totalAssigned
              return { ...prev, envelopes: updated, totalAssigned, readyToAssign: rta, isOverAssigned: rta < 0 }
            })
            setMoveMoneyTarget(null)
          }}
        />
      )}
      {categoryMenu}
        </div>
      </div>
    </section>
  )
}
