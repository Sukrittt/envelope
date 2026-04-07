import { useEffect, useState } from 'react'
import { loadInsightsData, type InsightsData } from '../services/insightsAdapter'

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

  const { projection, categoryBudgetLens, fixedVariable, insightChips } = data
  const projPct = Math.min(100, projection.cap > 0 ? (projection.projectedTotal / projection.cap) * 100 : 0)
  const adjustedProjPct = Math.min(100, projection.cap > 0 ? (projection.adjustedProjectedTotal / projection.cap) * 100 : 0)
  const currentPct = Math.min(100, projection.cap > 0 ? (projection.currentSpend / projection.cap) * 100 : 0)

  return (
    <div className="insights-grid insights-grid--v2">
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

      <article className="mc-panel insights-panel">
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
