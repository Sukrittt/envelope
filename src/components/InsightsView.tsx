import { useEffect, useState } from 'react'
import { loadInsightsData, type InsightsData } from '../services/insightsAdapter'
import { SparkBars } from './SparkBars'

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

const MONTHLY_CAP = 45000

export function InsightsView({ hideAmounts = false }: { hideAmounts?: boolean }) {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInsightsData(MONTHLY_CAP)
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  function amt(value: number): React.ReactNode {
    if (hideAmounts) return <span className="currency-hidden">--</span>
    return formatCurrency(value)
  }

  function amtStr(value: number): string {
    return hideAmounts ? '---' : formatCurrency(value)
  }

  if (loading) return <div className="insights-loading">Loading insights…</div>
  if (!data) return <div className="insights-loading">Failed to load insights data.</div>

  const { projection, categoryBudgetLens, fixedVariable, insightChips, avgByCategory, categoryTrends, patterns, subscriptionBurn } = data
  const projPct = Math.min(100, projection.cap > 0 ? (projection.projectedTotal / projection.cap) * 100 : 0)
  const adjustedProjPct = Math.min(100, projection.cap > 0 ? (projection.adjustedProjectedTotal / projection.cap) * 100 : 0)
  const currentPct = Math.min(100, projection.cap > 0 ? (projection.currentSpend / projection.cap) * 100 : 0)

  const totalAvg = avgByCategory.reduce((s, c) => s + c.avgMonthly, 0)
  const topTrendCategories = categoryTrends.slice(0, 5)
  const topDaysMax = patterns.topDays.length > 0 ? Math.max(...patterns.topDays.map((d) => d.avgSpend)) : 1

  // Build conic-gradient for donut
  let gradientStops = ''
  let cumPct = 0
  for (const cat of avgByCategory) {
    const pct = totalAvg > 0 ? (cat.avgMonthly / totalAvg) * 100 : 0
    gradientStops += `${cat.color} ${cumPct}% ${cumPct + pct}%, `
    cumPct += pct
  }
  gradientStops = gradientStops.replace(/, $/, '')

  return (
    <div className="insights-grid insights-grid--v2">
      {/* 1. Insight chips */}
      <article className="mc-panel insights-panel insights-panel--full">
        <div className="mc-panel-header">
          <h3>Insight chips</h3>
          <p>Quick guidance for this month</p>
        </div>
        <div className="insight-chip-row">
          {insightChips.map((chip) => (
            <span key={chip} className="mc-chip mc-chip--neutral">{chip}</span>
          ))}
        </div>
      </article>

      {/* 2. Month-End Projection (Forecast realism - tightened) */}
      <article className="mc-panel insights-panel insights-panel--full">
        <div className="mc-panel-header">
          <h3>Forecast realism</h3>
          <p>Run-rate with one-off adjustment</p>
        </div>
        <div className="projection-stats projection-stats--2col">
          <div className="mc-kpi-card expense-kpi">
            <p>Current spend</p>
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(projection.currentSpend)}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Base projection</p>
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(projection.projectedTotal)}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Adjusted projection</p>
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(projection.adjustedProjectedTotal)}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Confidence</p>
            <strong>{projection.confidence}</strong>
            <span className="muted">{projection.daysLogged} days logged</span>
          </div>
        </div>
        <div className="projection-bar-wrap">
          <div className="projection-bar">
            <div className="projection-bar-current" style={{ width: `${currentPct}%` }} />
            <div className="projection-bar-projected" style={{ width: `${Math.min(projPct, 100)}%` }} />
            <div className="projection-bar-adjusted" style={{ width: `${Math.min(adjustedProjPct, 100)}%` }} />
          </div>
          <div className="projection-bar-labels">
            <span>Current ({currentPct.toFixed(0)}%)</span>
            <span>Base ({projPct.toFixed(0)}%)</span>
            <span>Adjusted ({adjustedProjPct.toFixed(0)}%)</span>
            <span>Cap {amtStr(projection.cap)}</span>
          </div>
        </div>
      </article>

      {/* 3. Category Spend Donut */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Category spend</h3>
          <p>Monthly average by category</p>
        </div>
        <div className="category-donut-layout">
          <div className="donut-wrap">
            <div
              className="donut-chart"
              style={{ background: `conic-gradient(${gradientStops})` }}
            />
            <div className="donut-center">
              <strong className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(totalAvg)}</strong>
              <span>/month</span>
            </div>
          </div>
          <div className="donut-legend">
            {avgByCategory.map((cat) => (
              <div key={cat.category} className="donut-legend-item">
                <span className="donut-legend-swatch" style={{ background: cat.color }} />
                <span className="donut-legend-label">{cat.category}</span>
                <span className={`donut-legend-value ${hideAmounts ? 'amount-hidden' : ''}`}>
                  {amtStr(cat.avgMonthly)}
                </span>
                <span className="donut-legend-pct">
                  {totalAvg > 0 ? `${Math.round((cat.avgMonthly / totalAvg) * 100)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </article>

      {/* 4. Category Trends (mini SparkBars) */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Category trends</h3>
          <p>3-month spending by category</p>
        </div>
        <div className="category-trends-grid">
          {topTrendCategories.map((trend) => (
            <div key={trend.category} className="category-trend-card">
              <div className="category-trend-header">
                <span>{trend.category}</span>
                {trend.changePct !== null && (
                  <span className={trend.changePct > 0 ? 'trend-up' : 'trend-down'}>
                    {trend.changePct > 0 ? '▲' : '▼'} {Math.abs(Math.round(trend.changePct))}%
                  </span>
                )}
              </div>
              <SparkBars
                data={trend.months.map((m) => ({ date: m.month, value: m.total }))}
                formatValue={(v) => (hideAmounts ? '---' : formatCurrency(v))}
                size="compact"
              />
            </div>
          ))}
        </div>
      </article>

      {/* 5. Spending Patterns */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Spending patterns</h3>
          <p>Essential vs discretionary &amp; top spending days</p>
        </div>
        <div className="patterns-grid">
          <div className="pattern-card">
            <h4>Essential vs Discretionary</h4>
            <div className="split-bar-wrap">
              <div className="split-amounts">
                <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(patterns.essentialTotal)}</span>
                <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(patterns.discretionaryTotal)}</span>
              </div>
              <div className="split-bar">
                <div className="split-bar-essential" style={{ width: `${patterns.essentialPct}%` }} />
              </div>
              <div className="split-bar-labels">
                <span>Essential {patterns.essentialPct}%</span>
                <span>Discretionary {100 - patterns.essentialPct}%</span>
              </div>
            </div>
          </div>
          <div className="pattern-card">
            <h4>Top spending days</h4>
            <div className="top-days-bars">
              {patterns.topDays.slice(0, 5).map((day) => (
                <div key={day.day} className="top-day-row">
                  <span className="top-day-label">{day.day}</span>
                  <div className="top-day-bar-track">
                    <div
                      className="top-day-bar-fill"
                      style={{ width: '100%', transform: `scaleX(${topDaysMax > 0 ? day.avgSpend / topDaysMax : 0})` }}
                    />
                  </div>
                  <span className={`top-day-value ${hideAmounts ? 'amount-hidden' : ''}`}>
                    {amtStr(day.avgSpend)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* 6. Subscription Burn */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Subscription burn</h3>
          <p>Monthly subscriptions vs cap</p>
        </div>
        <div className="sub-burn-gauge-wrap">
          <div className="sub-burn-gauge-header">
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(subscriptionBurn.totalMonthly)}</strong>
            <span className="muted"> / month — {subscriptionBurn.capPct}% of cap</span>
          </div>
          <div className="sub-burn-gauge-track">
            <div
              className="sub-burn-gauge-fill"
              style={{ width: '100%', transform: `scaleX(${Math.min(subscriptionBurn.capPct, 100) / 100})` }}
            />
          </div>
        </div>
        <div className="sub-burn-list">
          {subscriptionBurn.subscriptions.map((sub) => (
            <div key={sub.service} className="sub-burn-item">
              <span>{sub.service}</span>
              <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(sub.amountInr)}</span>
              <span className={`mc-chip mc-chip--${/^active/i.test(sub.status) ? 'green' : 'amber'}`}>
                {sub.status}
              </span>
            </div>
          ))}
        </div>
      </article>

      {/* 7. Fixed vs Variable */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Fixed vs Variable</h3>
          <p>Current month vs rolling 3-month average</p>
        </div>
        <table className="mc-compact-table">
          <thead>
            <tr>
              <th>Block</th>
              <th className="num">Current month</th>
              <th className="num">3m avg</th>
            </tr>
          </thead>
          <tbody>
            {fixedVariable.map((row) => (
              <tr key={row.type}>
                <td>{row.type}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.currentMonth)}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.avg3m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {/* 8. Category Budget Lens */}
      <article className="mc-panel insights-panel insights-panel--full">
        <div className="mc-panel-header">
          <h3>Category Budget Lens</h3>
          <p>3-month baseline vs this month with suggested caps</p>
        </div>
        <table className="mc-compact-table insights-table-scroll">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">3m avg/month</th>
              <th className="num">Current month</th>
              <th className="num">Gap vs avg</th>
              <th className="num">Suggested budget</th>
            </tr>
          </thead>
          <tbody>
            {categoryBudgetLens.map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.avg3m)}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.currentMonth)}</td>
                <td className={`num ${row.gapAmount > 0 ? 'trend-up' : 'trend-down'} ${hideAmounts ? 'amount-hidden' : ''}`}>
                  {row.gapAmount > 0 ? '+' : ''}{amtStr(row.gapAmount)}
                  {!hideAmounts && row.gapPct !== null ? ` (${row.gapPct > 0 ? '+' : ''}${row.gapPct.toFixed(0)}%)` : ''}
                </td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.suggestedBudget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {/* 9. Category Forecast */}
      <article className="mc-panel insights-panel insights-panel--full">
        <div className="mc-panel-header">
          <h3>Category forecast table</h3>
          <p>Cap status based on month-end forecast</p>
        </div>
        <table className="mc-compact-table insights-table-scroll">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">3m avg/month</th>
              <th className="num">Current month</th>
              <th className="num">Forecast month-end</th>
              <th className="num">Recommended cap</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {categoryBudgetLens.map((row) => (
              <tr key={`forecast-${row.category}`}>
                <td>{row.category}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.avg3m)}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.currentMonth)}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.forecastMonthEnd)}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(row.recommendedCap)}</td>
                <td>
                  <span className={`mc-chip mc-chip--${row.status === 'Over' ? 'red' : row.status === 'Watch' ? 'amber' : 'green'}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  )
}
