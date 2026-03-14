import { useEffect, useMemo, useRef, useState } from 'react'
import expenseSample from '../data/expensePanel.sample.json'
import { SparkBars } from '../components/SparkBars'
import { toExpensePanelData } from '../services/expensePanelAdapter'

type PeriodKey = '7d' | '30d' | 'mtd' | 'custom'
type TrendView = 'weekly' | 'monthly'

const panel = toExpensePanelData(expenseSample)
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
  return `₹${value.toFixed(0)}`
}

function weekKey(input: string): string {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return input
  const start = new Date(date)
  const diffToMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - diffToMonday)
  return start.toISOString().slice(0, 10)
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

export function ExpensePage() {
  const [period, setPeriod] = useState<PeriodKey>('mtd')
  const [trendView, setTrendView] = useState<TrendView>('weekly')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [scopePulse, setScopePulse] = useState(0)
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null)

  const latestDate = useMemo(() => {
    const last = panel.miniTrend.at(-1)?.date ?? panel.month
    const date = new Date(last)
    return Number.isNaN(date.getTime()) ? new Date() : date
  }, [])

  const [customStart, setCustomStart] = useState<string>(toDateInputValue(new Date(latestDate.getFullYear(), latestDate.getMonth(), 1)))
  const [customEnd, setCustomEnd] = useState<string>(toDateInputValue(latestDate))

  const categoryOptions = useMemo(() => panel.topCategories.map((category) => category.category), [])
  const allCategoriesSelected = selectedCategories.length === 0

  function selectAllCategories() {
    setSelectedCategories([])
    setScopePulse((value) => value + 1)
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]))
    setScopePulse((value) => value + 1)
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!categoryDropdownRef.current?.contains(event.target as Node)) {
        setIsCategoryOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const filteredTrend = useMemo(() => {
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
  }, [customEnd, customStart, latestDate, period])

  const visibleCategoryOptions = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    if (!query) return categoryOptions
    return categoryOptions.filter((category) => category.toLowerCase().includes(query))
  }, [categoryOptions, categoryQuery])

  const filteredCategories = useMemo(() => {
    if (!selectedCategories.length) return panel.topCategories
    return panel.topCategories.filter((row) => selectedCategories.includes(row.category))
  }, [selectedCategories])

  const categoryColorMap = useMemo(() => {
    return new Map(panel.topCategories.map((category, index) => [category.category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]]))
  }, [])

  const categoryTotal = useMemo(() => panel.topCategories.reduce((sum, row) => sum + row.amountInr, 0), [])

  const selectedCategoryTotal = useMemo(() => {
    if (!selectedCategories.length) return categoryTotal
    return panel.topCategories
      .filter((row) => selectedCategories.includes(row.category))
      .reduce((sum, row) => sum + row.amountInr, 0)
  }, [categoryTotal, selectedCategories])

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
    const source = filteredTrend.map((row) => ({ ...row, value: row.value * categoryScopeRatio }))
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
  }, [categoryScopeRatio, filteredTrend, trendView])

  const stalenessText = formatLastUpdated(panel.lastUpdated)
  const periodLabel = period === 'mtd' ? 'Month to date' : period === 'custom' ? 'Custom' : period === '7d' ? 'Last 7 days' : 'Last 30 days'
  const categoryScopeLabel = selectedCategories.length ? `${selectedCategories.length} selected` : 'All categories'

  const topCategory = filteredCategories[0] ?? panel.topCategories[0]
  const topCategoryShare = topCategory?.sharePct ?? 0
  const adjustedRunRate = panel.avgDailyLast7Inr * categoryScopeRatio

  const peakPoint = trendSeries.reduce((peak, row) => (row.value > peak.value ? row : peak), trendSeries[0] ?? { date: '-', value: 0 })

  const subscriptionCategory = panel.topCategories.find((row) => row.category.toLowerCase().includes('subscription'))
  const donutSegments = (selectedCategories.length ? filteredCategories : panel.topCategories).slice(0, 8)
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

      <section className="mc-filterbar expense-scopebar" aria-label="Scope bar">
        <div className="scope-group" role="group" aria-label="Period selector">
          <span className="toolbar-label">Period</span>
          <div className="mc-filter-chips" role="tablist" aria-label="Period presets">
            {(['7d', '30d', 'mtd'] as PeriodKey[]).map((key) => (
              <button key={key} type="button" className={`action-button ${period === key ? 'is-active' : ''}`} onClick={() => setPeriod(key)}>
                {key.toUpperCase()}
              </button>
            ))}
            <button type="button" className={`action-button ${period === 'custom' ? 'is-active' : ''}`} onClick={() => setPeriod('custom')}>
              Custom
            </button>
          </div>
        </div>

        {period === 'custom' ? (
          <div className="scope-group custom-dates">
            <label>
              Start
              <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Custom start date" />
            </label>
            <label>
              End
              <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Custom end date" />
            </label>
          </div>
        ) : null}

        <div className="scope-group scope-group--category" ref={categoryDropdownRef}>
          <span className="toolbar-label">Category</span>
          <button
            type="button"
            className={`action-button category-trigger ${isCategoryOpen ? 'is-active' : ''}`}
            onClick={() => setIsCategoryOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isCategoryOpen}
            aria-label="Category filter"
          >
            {allCategoriesSelected ? 'All categories' : 'Filtered categories'}
            <span className="mc-chip">Scope</span>
          </button>

          {isCategoryOpen ? (
            <div className="category-menu" role="menu" aria-label="Category multi-select">
              <input
                type="search"
                value={categoryQuery}
                onChange={(event) => setCategoryQuery(event.target.value)}
                placeholder="Search category"
                aria-label="Search category"
              />
              <div className="category-menu-list">
                <label className="category-option category-option--all">
                  <input type="checkbox" checked={allCategoriesSelected} onChange={selectAllCategories} />
                  <span>All categories</span>
                </label>
                {visibleCategoryOptions.length ? (
                  visibleCategoryOptions.map((category) => {
                    const selected = selectedCategories.includes(category)
                    return (
                      <label key={category} className={`category-option ${selected ? 'is-selected' : ''}`}>
                        <input type="checkbox" checked={selected} onChange={() => toggleCategory(category)} />
                        <span>{category}</span>
                      </label>
                    )
                  })
                ) : (
                  <p className="muted">No categories match</p>
                )}
              </div>
              <div className="category-menu-actions">
                {selectedCategories.length ? (
                  <button type="button" className="action-button is-ghost" onClick={selectAllCategories}>
                    All categories
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="action-button" onClick={() => setIsCategoryOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="scope-chip-row" aria-label="Active filters">
          <span className="mc-chip">{periodLabel}</span>
          <span className="mc-chip">{stalenessText}</span>
          <span className="mc-chip mc-chip--neutral">Scope: {allCategoriesSelected ? 'All categories' : selectedCategories.join(', ')}</span>
          <span className={`mc-chip scope-status-chip ${scopePulse ? 'is-pulse' : ''}`} key={scopePulse}>{categoryScopeLabel}</span>
        </div>
        <p className="scope-helper">Tip: click category cards to multi-select. Use “All categories” to reset global view.</p>
      </section>

      <section className="mc-kpi-strip mc-kpi-strip--expense" aria-label="Expense KPIs">
        <article className="mc-kpi-card expense-kpi">
          <p>Total spend vs cap</p>
          <strong className={panel.runRateStatus === 'overshoot' ? 'red' : ''}>{formatCurrency(filteredTotal)}</strong>
          <span className="kpi-delta">{periodDelta > 0 ? '+' : ''}{periodDelta.toFixed(1)}% vs previous slice</span>
          <span className="muted">Cap {formatCurrency(panel.monthlySpendCapInr)}</span>
        </article>

        <article className="mc-kpi-card expense-kpi">
          <p>Daily run rate</p>
          <strong>{formatCurrency(adjustedRunRate)}/day</strong>
          <span className="kpi-delta">Soft cap {formatCurrency(panel.dailySoftCapInr)}/day</span>
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
          <strong>{formatCurrency(panel.duesReceivableInr)}</strong>
          <span className="kpi-delta">Recovery buffer available</span>
          <span className="muted">Use before discretionary spends</span>
        </article>
      </section>

      <section className="expense-grid-xman">
        <article className="mc-panel expense-trend-panel">
          <div className="mc-panel-header">
            <h3>Spending trend</h3>
            <div className="segmented-control trend-toggle">
              <button type="button" className={`action-button ${trendView === 'weekly' ? 'is-active' : ''}`} onClick={() => setTrendView('weekly')}>
                Weekly
              </button>
              <button type="button" className={`action-button ${trendView === 'monthly' ? 'is-active' : ''}`} onClick={() => setTrendView('monthly')}>
                Monthly
              </button>
            </div>
          </div>
          <p className="muted">{periodLabel} • Peak {peakPoint.date} ({formatCurrency(peakPoint.value)})</p>
          <SparkBars data={trendSeries} size="expanded" showReferenceLines formatValue={(value) => formatCurrency(value)} />
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
                  <td className="num">{formatCurrency(week.totalInr)}</td>
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
          <p className="subscription-amount">{formatCurrency(subscriptionCategory?.amountInr ?? 0)}</p>

          <div className="subscription-lists">
            <details className="mc-accordion-item subscription-accordion" open>
              <summary>
                <h4>Active ({panel.subscriptions.active.length})</h4>
                <span className="chevron" aria-hidden="true">▾</span>
              </summary>
              <ul className="compact-bullets compact-bullets--tight">
                {panel.subscriptions.active.map((sub) => (
                  <li key={`${sub.service}-${sub.status}`}>
                    <strong>{sub.service}</strong> · {sub.billingCycle} · {formatCurrency(sub.amountInr)}
                  </li>
                ))}
              </ul>
            </details>

            <details className="mc-accordion-item subscription-accordion">
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
                <span>{formatCurrency(selectedCategoryTotal)}</span>
              </div>
            </div>
            <div className="category-card-grid">
              <button
                type="button"
                className={`category-row category-card ${allCategoriesSelected ? 'is-focused' : ''}`}
                onClick={selectAllCategories}
              >
                <div>
                  <p className="risk-title">All categories</p>
                  <p className="risk-meta">Reset to full dashboard scope</p>
                </div>
                <span className="mc-chip mc-chip--neutral">{allCategoriesSelected ? 'Active' : 'Reset'}</span>
              </button>

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
                      <p className="risk-meta">{formatCurrency(category.amountInr)}</p>
                    </div>
                    <span className="mc-chip">{category.sharePct}%</span>
                  </button>
                )
              })}
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
    </section>
  )
}
