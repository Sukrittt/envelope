import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SparkBars } from '../components/SparkBars'
import { TransactionsView } from '../components/TransactionsView'
import { InsightsView } from '../components/InsightsView'
import { toExpensePanelData, type ExpensePanelData } from '../services/expensePanelAdapter'
import { loadExpensePanelContract } from '../services/expensePanelLoader'

type PeriodKey = '7d' | '30d' | 'mtd' | 'custom'
type TrendView = 'daily' | 'weekly' | 'monthly'
type DrillFilter = { start: string; end: string; parentView: TrendView } | null

const CATEGORY_COLORS = ['#7aa2ff', '#4fd1c5', '#f59e8b', '#b794f4', '#f6c453', '#63b3ed', '#f472b6', '#34d399']

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

type ExpenseTab = 'overview' | 'transactions' | 'insights'

export function ExpensePage() {
  const [panel, setPanel] = useState<ExpensePanelData | null>(null)
  const [activeTab, setActiveTab] = useState<ExpenseTab>('overview')
  const [period, setPeriod] = useState<PeriodKey>('mtd')
  const [trendView, setTrendView] = useState<TrendView>('daily')
  const [drillFilter, setDrillFilter] = useState<DrillFilter>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)
  const [categoryMenuPosition, setCategoryMenuPosition] = useState<{ top: number; left: number; minWidth: number } | null>(null)
  const [hideAmounts, setHideAmounts] = useState<boolean>(() => {
    const stored = localStorage.getItem('expense-hide-amounts')
    return stored === 'true'
  })
  const [dailyDetailDate, setDailyDetailDate] = useState<string | null>(null)
  const categoryMenuRef = useRef<HTMLDivElement | null>(null)
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    loadExpensePanelContract().then((contract) => setPanel(toExpensePanelData(contract)))
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

  function toggleHideAmounts() {
    setHideAmounts((prev) => {
      const next = !prev
      localStorage.setItem('expense-hide-amounts', String(next))
      return next
    })
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

  const filteredCategories = useMemo(() => {
    if (!panel) return []
    if (!selectedCategories.length) return panel.topCategories
    return panel.topCategories.filter((row) => selectedCategories.includes(row.category))
  }, [panel, selectedCategories])

  const categoryColorMap = useMemo(() => {
    if (!panel) return new Map<string, string>()
    return new Map(panel.topCategories.map((category, index) => [category.category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]]))
  }, [panel])

  const categoryTotal = useMemo(() => panel?.topCategories.reduce((sum, row) => sum + row.amountInr, 0) ?? 0, [panel])

  const selectedCategoryTotal = useMemo(() => {
    if (!panel || !selectedCategories.length) return categoryTotal
    return panel.topCategories
      .filter((row) => selectedCategories.includes(row.category))
      .reduce((sum, row) => sum + row.amountInr, 0)
  }, [categoryTotal, panel, selectedCategories])

  const categoryScopeRatio = categoryTotal > 0 ? selectedCategoryTotal / categoryTotal : 1
  const periodTotal = useMemo(() => filteredTrend.reduce((sum, point) => sum + point.value, 0), [filteredTrend])
  const filteredTotal = periodTotal * categoryScopeRatio

  const periodDelta = useMemo(() => {
    if (filteredTrend.length < 2) return 0
    const half = Math.floor(filteredTrend.length / 2)
    const first = filteredTrend.slice(0, half)
    const second = filteredTrend.slice(half)
    const firstAvg = first.length ? first.reduce((sum, row) => sum + row.value, 0) / first.length : 0
    const secondAvg = second.length ? second.reduce((sum, row) => sum + row.value, 0) / second.length : 0
    if (!firstAvg) return 0
    return ((secondAvg - firstAvg) / firstAvg) * 100
  }, [filteredTrend])

  const trendSeries = useMemo(() => {
    let source = filteredTrend.map((row) => ({ ...row, value: row.value * categoryScopeRatio }))

    if (drillFilter) {
      source = source.filter((row) => row.date >= drillFilter.start && row.date <= drillFilter.end)
    }

    if (trendView === 'daily') {
      if (!drillFilter) {
        const now = new Date()
        const today = now.toISOString().slice(0, 10)
        const startOfWeek = new Date(now)
        const diffToMonday = (startOfWeek.getDay() + 6) % 7
        startOfWeek.setDate(now.getDate() - diffToMonday)
        const weekStart = startOfWeek.toISOString().slice(0, 10)
        source = source.filter((row) => row.date >= weekStart && row.date <= today)
      }
      return source.map((row) => ({ date: row.date, value: row.value }))
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
  }, [categoryScopeRatio, drillFilter, filteredTrend, trendView])

  const trendKeys = useMemo(() => {
    let source = filteredTrend
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
  }, [drillFilter, filteredTrend, trendView])

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

  const topCats = panel?.topCategories ?? []
  const topCategory = filteredCategories[0] ?? topCats[0]
  const topCategoryShare = topCategory?.sharePct ?? 0
  const adjustedRunRate = (panel?.avgDailyLast7Inr ?? 0) * categoryScopeRatio

  const subscriptionCategory = topCats.find((row) => row.category.toLowerCase().includes('subscription'))
  const donutSegments = (selectedCategories.length ? filteredCategories : topCats).slice(0, 8)
  const donutGradient = useMemo(() => {
    if (!donutSegments.length) return 'conic-gradient(#3b3f47 0 100%)'

    const total = donutSegments.reduce((sum, segment) => sum + segment.amountInr, 0)
    if (!total) return 'conic-gradient(#3b3f47 0 100%)'

    let start = 0
    const slices = donutSegments.map((segment) => {
      const segmentPct = (segment.amountInr / total) * 100
      const next = start + segmentPct
      const color = categoryColorMap.get(segment.category) ?? '#8f97a3'
      const slice = `${color} ${start}% ${Math.min(100, next)}%`
      start = next
      return slice
    })
    if (start < 100) {
      slices.push(`#2f333a ${start}% 100%`)
    }
    return `conic-gradient(${slices.join(', ')})`
  }, [categoryColorMap, donutSegments])

  if (!panel) {
    return (
      <section className="mc-content-grid expense-view" aria-busy="true" aria-live="polite">
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

  return (
    <section className="mc-content-grid expense-view">
      <section className="headline">
        <div>
          <h1>Expense Command Center</h1>
          <p className="muted">{panel.month} • Premium dark control board</p>
        </div>
        <span className={`mc-chip mc-chip--${panel.runRateStatus === 'overshoot' ? 'red' : panel.runRateStatus === 'watch' ? 'amber' : 'green'}`}>
          {panel.runRateStatus === 'overshoot' ? 'CAP BREACHED' : panel.runRateStatus === 'watch' ? 'WATCH' : 'ON TRACK'}
        </span>
      </section>

      <div className="expense-tab-row">
        <div className="tab-nav expense-tab-nav">
          <button type="button" className={`tab-button expense-tab-button ${activeTab === 'overview' ? 'is-active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button type="button" className={`tab-button expense-tab-button ${activeTab === 'transactions' ? 'is-active' : ''}`} onClick={() => setActiveTab('transactions')}>
            Transactions
          </button>
          <button type="button" className={`tab-button expense-tab-button ${activeTab === 'insights' ? 'is-active' : ''}`} onClick={() => setActiveTab('insights')}>
            Insights
          </button>
        </div>

        <button type="button" className={`action-button hide-amounts-toggle ${hideAmounts ? 'is-active' : ''}`} onClick={toggleHideAmounts}>
          {hideAmounts ? '👁️ Show amounts' : '🔒 Hide amounts'}
        </button>
      </div>

      {activeTab === 'transactions' ? (
        <div className="expense-tab-content">
          <TransactionsView hideAmounts={hideAmounts} />
        </div>
      ) : activeTab === 'insights' ? (
        <div className="expense-tab-content">
          <InsightsView hideAmounts={hideAmounts} />
        </div>
      ) : (<>

      <div className="expense-tab-content">
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

      <section className="mc-kpi-strip mc-kpi-strip--expense" aria-label="Expense KPIs">
        <article className="mc-kpi-card expense-kpi">
          <p>Total spend vs cap</p>
          <strong className={`${panel.runRateStatus === 'overshoot' ? 'red' : ''} ${hideAmounts ? 'amount-hidden' : ''}`}>{formatCurrencyHidden(filteredTotal)}</strong>
          <span className="kpi-delta">{periodDelta > 0 ? '+' : ''}{periodDelta.toFixed(1)}% vs previous slice</span>
          <span className="muted">Cap {formatCurrencyHidden(panel.monthlySpendCapInr)}</span>
        </article>

        <article className="mc-kpi-card expense-kpi">
          <p>Daily run rate</p>
          <strong className={hideAmounts ? 'amount-hidden' : ''}>{formatCurrencyHidden(adjustedRunRate)}/day</strong>
          <span className="kpi-delta">Soft cap {formatCurrencyHidden(panel.dailySoftCapInr)}/day</span>
          <span className="muted">Filtered by period + category</span>
        </article>

        <article className="mc-kpi-card expense-kpi">
          <p>Top category pressure</p>
          <strong>{topCategoryShare}%</strong>
          <span className="kpi-delta">{topCategory?.category ?? 'Category'}</span>
          <span className="muted">Share of total spend</span>
        </article>

        <article className="mc-kpi-card expense-kpi">
          <p>Dues receivable</p>
          <strong className={hideAmounts ? 'amount-hidden' : ''}>{formatCurrencyHidden(panel.duesReceivableInr)}</strong>
          <span className="kpi-delta">Recovery buffer available</span>
          <span className="muted">Use before discretionary spends</span>
        </article>
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
            showReferenceLines
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

        <article className="mc-panel expense-weekly-panel">
          <div className="mc-panel-header">
            <h3>Weekly anomalies</h3>
            <p>Largest spend weeks first</p>
          </div>
          <table className="mc-compact-table">
            <thead>
              <tr>
                <th>Week</th>
                <th className="num">Spend</th>
              </tr>
            </thead>
            <tbody>
              {panel.weeklyAnomalies.slice(0, 4).map((week) => (
                <tr key={week.key}>
                  <td>{week.label}</td>
                  <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{hideAmounts ? '---' : formatCurrency(week.totalInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="mc-panel expense-subscriptions-panel">
          <div className="mc-panel-header">
            <h3>Subscriptions</h3>
            <p>Recurring drag</p>
          </div>
          <p className={`subscription-amount ${hideAmounts ? 'amount-hidden' : ''}`}>{formatCurrencyHidden(subscriptionCategory?.amountInr ?? 0)}</p>

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

        <article className="mc-panel expense-review-panel">
          <div className="mc-panel-header">
            <h3>Weekly review & insights</h3>
            <p>Concise decision notes</p>
          </div>
          <div className="review-points">
            <div>
              <h4>What went wrong</h4>
              <p>{panel.weeklyInsights.wentWrong}</p>
            </div>
            <div>
              <h4>What to do next</h4>
              <p>{panel.weeklyInsights.nextWeek}</p>
            </div>
          </div>
          <div className="mc-summary-row">
            {panel.alerts.slice(0, 2).map((alert) => (
              <span key={alert} className="mc-chip mc-chip--neutral premium-chip">
                {alert}
              </span>
            ))}
          </div>
        </article>

        <article className="mc-panel expense-category-panel">
          <div className="mc-panel-header">
            <h3>Category breakdown</h3>
            <p>Donut + ranked list</p>
          </div>
          <div className="category-breakdown-grid">
            <div className="donut-wrap" aria-label="Category share donut" role="img">
              <div className="donut-chart" style={{ backgroundImage: donutGradient }} />
              <div className="donut-center">
                <strong>{selectedCategories.length ? categoryScopeLabel : 'All categories'}</strong>
                <span className={hideAmounts ? 'amount-hidden' : ''}>{hideAmounts ? '---' : formatCurrency(selectedCategoryTotal)}</span>
              </div>
            </div>
            <div className="category-card-stack">
              <button
                type="button"
                className={`category-row category-card category-card--all ${allCategoriesSelected ? 'is-focused' : ''}`}
                onClick={selectAllCategories}
              >
                <div>
                  <p className="risk-title">All categories</p>
                  <p className="risk-meta">Reset to full dashboard scope</p>
                </div>
                <span className="mc-chip mc-chip--neutral">{allCategoriesSelected ? 'Active' : 'Reset'}</span>
              </button>

              <div className="category-card-grid">
                {panel.topCategories.slice(0, 8).map((category) => {
                  const isFocused = selectedCategories.includes(category.category)
                  return (
                    <button
                      type="button"
                      key={category.category}
                      className={`category-row category-card ${isFocused ? 'is-focused' : ''}`}
                      onClick={() => toggleCategory(category.category)}
                    >
                      <div>
                        <p className="risk-title">
                          <span className="category-dot" style={{ background: categoryColorMap.get(category.category) }} />
                          {category.category}
                        </p>
                        <p className={`risk-meta ${hideAmounts ? 'amount-hidden' : ''}`}>{formatCurrencyHidden(category.amountInr)}</p>
                      </div>
                      <span className="mc-chip">{category.sharePct}%</span>
                    </button>
                  )
                })}
              </div>
            </div>
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
      </>)}
      {categoryMenu}
    </section>
  )
}
