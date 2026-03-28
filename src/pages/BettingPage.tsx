import { useMemo, useState } from 'react'

type RiskMode = 'strict' | 'balanced' | 'aggressive'

const marketBlueprint = [
  {
    title: 'Powerplay Runs Band',
    why: 'Lower variance than match-winner bets; reacts to pitch + intent.',
    checklist: ['Venue PP average', 'Bowling matchup in first 6 overs', 'Dew impact in 2nd innings'],
  },
  {
    title: 'Team Innings Total Band',
    why: 'Best for forecast discipline and range-based decisions.',
    checklist: ['Pitch pace/spin behavior', 'Top-order form', 'Death overs economy rates'],
  },
  {
    title: 'Top Batter Conservative Line',
    why: 'Prefer cushion lines over high-risk milestone lines.',
    checklist: ['Recent 5 innings median', 'Matchup vs likely bowlers', 'Role certainty (opening/anchor/finisher)'],
  },
]

const checklist = [
  'Lock bankroll and stake caps before seeing odds.',
  'Use only range markets first; avoid parlay stacking.',
  'Skip if toss/pitch uncertainty remains high.',
  'No chase mode after a loss. Halt at daily cap.',
]

export function BettingPage() {
  const [bankroll, setBankroll] = useState(5000)
  const [riskMode, setRiskMode] = useState<RiskMode>('strict')

  const stakeBand = useMemo(() => {
    if (riskMode === 'strict') return { low: bankroll * 0.005, high: bankroll * 0.01 }
    if (riskMode === 'balanced') return { low: bankroll * 0.01, high: bankroll * 0.015 }
    return { low: bankroll * 0.015, high: bankroll * 0.02 }
  }, [bankroll, riskMode])

  const dailyLossCap = useMemo(() => bankroll * (riskMode === 'strict' ? 0.03 : riskMode === 'balanced' ? 0.05 : 0.07), [bankroll, riskMode])

  return (
    <section className="mc-content-grid">
      <article className="mc-panel">
        <div className="mc-panel-header">
          <h1>Betting Department (IPL)</h1>
          <p>High-probability framework (risk-managed). No blind picks.</p>
        </div>

        <section className="mc-kpi-strip mc-kpi-strip--stack">
          <article className="mc-kpi-card">
            <p>Bankroll</p>
            <strong>₹{bankroll.toLocaleString('en-IN')}</strong>
            <span className="muted">Set this per month/week based on comfort.</span>
          </article>
          <article className="mc-kpi-card">
            <p>Recommended stake / bet</p>
            <strong>
              ₹{Math.round(stakeBand.low).toLocaleString('en-IN')} – ₹{Math.round(stakeBand.high).toLocaleString('en-IN')}
            </strong>
            <span className="muted">Calculated from selected risk mode.</span>
          </article>
          <article className="mc-kpi-card">
            <p>Daily loss cap</p>
            <strong className="amber">₹{Math.round(dailyLossCap).toLocaleString('en-IN')}</strong>
            <span className="muted">Stop after this cap is hit.</span>
          </article>
        </section>

        <div className="mc-filterbar" aria-label="Betting controls">
          <label>
            Bankroll (₹)
            <input type="number" min={1000} step={500} value={bankroll} onChange={(event) => setBankroll(Number(event.target.value) || 0)} />
          </label>
          <label>
            Risk mode
            <select value={riskMode} onChange={(event) => setRiskMode(event.target.value as RiskMode)}>
              <option value="strict">Strict (recommended)</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
        </div>
      </article>

      <article className="mc-panel">
        <div className="mc-panel-header">
          <h2>Market Blueprint</h2>
          <p>Focus on lower-variance market types</p>
        </div>
        <div className="learning-list">
          {marketBlueprint.map((market) => (
            <article key={market.title} className="mc-learning-card">
              <div className="learning-top">
                <strong>{market.title}</strong>
                <span>Priority market</span>
              </div>
              <p>{market.why}</p>
              <ul>
                {market.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </article>

      <article className="mc-panel">
        <div className="mc-panel-header">
          <h2>Execution Checklist</h2>
          <p>Use this before placing any entry</p>
        </div>
        <ul className="risk-list">
          {checklist.map((item) => (
            <li key={item} className="mc-risk-row severity-low">
              <div>
                <p className="risk-title">{item}</p>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}
