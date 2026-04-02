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

  const { avgByCategory, categoryTrends, projection, subscriptionBurn, patterns } = data
  const projPct = Math.min(100, projection.cap > 0 ? (projection.projectedTotal / projection.cap) * 100 : 0)
  const currentPct = Math.min(100, projection.cap > 0 ? (projection.currentSpend / projection.cap) * 100 : 0)

  return (
    <div className="insights-grid">
      {/* 1. Average Monthly Spend by Category */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Avg Monthly Spend by Category</h3>
          <p>Across all tracked months</p>
        </div>
        <SparkBars
          data={avgByCategory.slice(0, 10).map((c) => ({ date: c.category, value: c.avgMonthly }))}
          formatValue={(v) => amtStr(v)}
          size="default"
        />
      </article>

      {/* 2. Month-over-Month Trend per Category */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Category Trends</h3>
          <p>Month-over-month change</p>
        </div>
        <table className="mc-compact-table">
          <thead>
            <tr>
              <th>Category</th>
              {categoryTrends[0]?.months.map((m) => (
                <th key={m.month} className="num">{m.month.slice(5)}</th>
              ))}
              <th className="num">Change</th>
            </tr>
          </thead>
          <tbody>
            {categoryTrends.slice(0, 10).map((t) => (
              <tr key={t.category}>
                <td>{t.category}</td>
                {t.months.map((m) => (
                  <td key={m.month} className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>
                    {m.total > 0 ? amtStr(m.total) : '—'}
                  </td>
                ))}
                <td className={`num ${t.changePct !== null ? (t.changePct > 0 ? 'trend-up' : 'trend-down') : ''}`}>
                  {t.changePct !== null ? `${t.changePct > 0 ? '+' : ''}${t.changePct.toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {/* 3. Projected Month-End Spend */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Month-End Projection</h3>
          <p>Based on daily run rate</p>
        </div>
        <div className="projection-stats">
          <div className="mc-kpi-card expense-kpi">
            <p>Current spend</p>
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(projection.currentSpend)}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Projected total</p>
            <strong className={`${projPct > 100 ? 'red' : ''} ${hideAmounts ? 'amount-hidden' : ''}`}>{amt(projection.projectedTotal)}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Days remaining</p>
            <strong>{projection.daysRemaining}</strong>
          </div>
          <div className="mc-kpi-card expense-kpi">
            <p>Safe daily budget</p>
            <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(projection.safeDailyBudget)}</strong>
          </div>
        </div>
        <div className="projection-bar-wrap">
          <div className="projection-bar">
            <div className="projection-bar-current" style={{ width: `${currentPct}%` }} />
            <div className="projection-bar-projected" style={{ width: `${Math.min(projPct, 100)}%` }} />
            <div className="projection-bar-cap" />
          </div>
          <div className="projection-bar-labels">
            <span>Current ({currentPct.toFixed(0)}%)</span>
            <span className={projPct > 100 ? 'red' : ''}>Projected ({projPct.toFixed(0)}%)</span>
            <span>Cap {amtStr(projection.cap)}</span>
          </div>
        </div>
      </article>

      {/* 4. Subscription Burn Rate */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Subscription Burn</h3>
          <p>{subscriptionBurn.capPct}% of monthly cap</p>
        </div>
        <div className="subscription-burn-header">
          <strong className={hideAmounts ? 'amount-hidden' : ''}>{amt(subscriptionBurn.totalMonthly)}</strong>
          <span className="muted">/month (effective)</span>
        </div>
        <table className="mc-compact-table">
          <thead>
            <tr>
              <th>Service</th>
              <th className="num">Amount</th>
              <th>Cycle</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {subscriptionBurn.subscriptions.map((s) => (
              <tr key={s.service} className={/cancel/i.test(s.status) ? 'row-cancelled' : ''}>
                <td>{s.service}</td>
                <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{amtStr(s.amountInr)}</td>
                <td>{s.billingCycle}</td>
                <td>
                  <span className={`mc-chip mc-chip--${/^active/i.test(s.status) ? 'green' : 'neutral'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      {/* 5. Spending Patterns */}
      <article className="mc-panel insights-panel">
        <div className="mc-panel-header">
          <h3>Spending Patterns</h3>
          <p>This month's habits</p>
        </div>
        <div className="patterns-grid">
          <div className="pattern-card">
            <h4>Top Spending Days</h4>
            <div className="pattern-day-list">
              {patterns.topDays.slice(0, 4).map((d) => (
                <div key={d.day} className="pattern-day-row">
                  <span>{d.day}</span>
                  <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(d.avgSpend)} avg</span>
                </div>
              ))}
            </div>
            {patterns.topDays[0] && (
              <p className="muted pattern-hint">You spend most on {patterns.topDays[0].day}s</p>
            )}
          </div>
          <div className="pattern-card">
            <h4>Essential vs Discretionary</h4>
            <div className="split-bar-wrap">
              <div className="split-bar">
                <div className="split-bar-essential" style={{ width: `${patterns.essentialPct}%` }} />
              </div>
              <div className="split-bar-labels">
                <span>Essential {patterns.essentialPct}%</span>
                <span>Discretionary {100 - patterns.essentialPct}%</span>
              </div>
            </div>
            <div className="split-amounts">
              <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(patterns.essentialTotal)}</span>
              <span className={hideAmounts ? 'amount-hidden' : ''}>{amtStr(patterns.discretionaryTotal)}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
