import { useState, useMemo } from 'react'
import fitnessContract from '../../productivity/fitness/fitness-dashboard.sample.json'
import { SparkBars } from '../components/SparkBars'
import { toFitnessDashboardPanel } from '../services/fitnessDashboardAdapter'

const panel = toFitnessDashboardPanel(fitnessContract as never)

function trendTone(value: number) {
  if (value < 0) return 'green'
  if (value > 0) return 'amber'
  return ''
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

type SplitFilter = 'all' | 'push' | 'pull' | 'legs'
type FitnessTab = 'overview' | 'training' | 'food'

const ITEMS_PER_PAGE = 10

export function FitnessPage() {
  const [activeTab, setActiveTab] = useState<FitnessTab>('overview')
  const [splitFilter, setSplitFilter] = useState<SplitFilter>('all')
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | 'all'>('all')
  const [prSearch, setPrSearch] = useState('')
  const [prMinWeight, setPrMinWeight] = useState('')
  const [trainingPage, setTrainingPage] = useState(1)
  const [foodPage, setFoodPage] = useState(1)
  const [trainingDateFrom, setTrainingDateFrom] = useState('')
  const [trainingDateTo, setTrainingDateTo] = useState('')
  const [selectedFoodDate, setSelectedFoodDate] = useState<{ date: string; meals: typeof panel.foodLog } | null>(null)

  const filteredWorkouts = useMemo(() => {
    let logs = panel.workoutLogs
    if (splitFilter !== 'all') {
      logs = logs.filter((log) => log.type.toLowerCase() === splitFilter)
    }
    if (trainingDateFrom) {
      logs = logs.filter((log) => log.date >= trainingDateFrom)
    }
    if (trainingDateTo) {
      logs = logs.filter((log) => log.date <= trainingDateTo)
    }
    return logs
  }, [splitFilter, trainingDateFrom, trainingDateTo])

  const filteredPRs = useMemo(() => {
    let prs = panel.exercisePRs
    if (splitFilter !== 'all') {
      prs = prs.filter((pr) => pr.type.toLowerCase() === splitFilter)
    }
    if (prSearch) {
      prs = prs.filter((pr) => pr.exercise.toLowerCase().includes(prSearch.toLowerCase()))
    }
    if (prMinWeight) {
      prs = prs.filter((pr) => pr.weight >= parseFloat(prMinWeight))
    }
    return prs.sort((a, b) => b.weight - a.weight)
  }, [splitFilter, prSearch, prMinWeight])

  const paginatedWorkouts = useMemo(() => {
    const start = (trainingPage - 1) * ITEMS_PER_PAGE
    return filteredWorkouts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredWorkouts, trainingPage])

  const totalTrainingPages = Math.ceil(filteredWorkouts.length / ITEMS_PER_PAGE)

  const displayWeightSeries = timeRange === 'all' 
    ? panel.weightSeries 
    : timeRange === '7d' 
      ? panel.weightSeries.slice(-7)
      : panel.weightSeries.slice(-14)

  const displayProteinSeries = timeRange === 'all'
    ? panel.proteinSeries
    : timeRange === '7d'
      ? panel.proteinSeries.slice(-7)
      : panel.proteinSeries.slice(-14)

  const sortedFoodLog = useMemo(() => {
    return [...panel.foodLog].sort((a, b) => b.date.localeCompare(a.date))
  }, [])

  const paginatedFoodLog = useMemo(() => {
    const start = (foodPage - 1) * ITEMS_PER_PAGE
    return sortedFoodLog.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedFoodLog, foodPage])

  const totalFoodPages = Math.ceil(sortedFoodLog.length / ITEMS_PER_PAGE)

  return (
    <section className="mc-content-grid fitness-view">
      <section className="headline">
        <div>
          <h1>Fitness Dashboard</h1>
          <p className="muted">Updated {new Date(panel.lastUpdated).toLocaleDateString()}</p>
        </div>
        <span className="mc-chip mc-chip--green">{panel.remainingKg.toFixed(1)} kg to target</span>
      </section>

      <div className="tab-nav">
        <button
          type="button"
          className={`tab-button ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'training' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('training')}
        >
          Training & PRs
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === 'food' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('food')}
        >
          Food Log
        </button>
      </div>

      {activeTab === 'overview' && (
        <>
          <section className="mc-kpi-strip" aria-label="Fitness KPIs">
            <article className="mc-kpi-card expense-kpi">
              <p>Current Weight</p>
              <strong>{panel.currentWeightKg.toFixed(1)} kg</strong>
              <span className="kpi-delta">
                <span className={trendTone(panel.weightTrend7d)}>
                  {panel.weightTrend7d > 0 ? '+' : ''}{panel.weightTrend7d} kg/wk
                </span>
              </span>
              <span className="muted">Target: {panel.targetWeightKg.toFixed(1)} kg</span>
            </article>

            <article className="mc-kpi-card expense-kpi">
              <p>Training</p>
              <strong>{panel.trainingCompletionPct.toFixed(0)}%</strong>
              <span className="kpi-delta">
                {panel.trainingDetail.completedSessions}/{panel.trainingDetail.plannedSessions} sessions
              </span>
              <span className="muted">Streak: {panel.workoutStreakDays} days</span>
            </article>

            <article className="mc-kpi-card expense-kpi">
              <p>Protein Avg</p>
              <strong>{panel.avgProteinG.toFixed(0)} g</strong>
              <span className="kpi-delta">{panel.summaryCards.proteinDaysMet7d}/7 days met</span>
              <span className="muted">Target: {panel.proteinTargetG} g</span>
            </article>

            <article className="mc-kpi-card expense-kpi">
              <p>Adherence</p>
              <strong className="green">{panel.adherencePct.toFixed(1)}%</strong>
              <span className="kpi-delta">Week: {panel.summaryCards.adherenceWeekPct.toFixed(0)}%</span>
              <span className="muted">Month: {panel.summaryCards.adherenceMonthPct.toFixed(0)}%</span>
            </article>
          </section>

          <section className="mc-main-panels">
            <article className="mc-panel">
              <div className="mc-panel-header">
                <h3>Weight trend</h3>
                <div className="filter-bar">
                  <button
                    type="button"
                    className={`action-button ${timeRange === '7d' ? 'is-active' : ''}`}
                    onClick={() => setTimeRange('7d')}
                  >
                    7d
                  </button>
                  <button
                    type="button"
                    className={`action-button ${timeRange === '14d' ? 'is-active' : ''}`}
                    onClick={() => setTimeRange('14d')}
                  >
                    14d
                  </button>
                  <button
                    type="button"
                    className={`action-button ${timeRange === 'all' ? 'is-active' : ''}`}
                    onClick={() => setTimeRange('all')}
                  >
                    All
                  </button>
                </div>
              </div>
              <SparkBars data={displayWeightSeries} formatValue={(value) => `${value.toFixed(1)} kg`} />
            </article>

            <article className="mc-panel">
              <div className="mc-panel-header">
                <h3>Protein trend</h3>
              </div>
              <SparkBars data={displayProteinSeries} formatValue={(value) => `${value.toFixed(0)} g`} />
            </article>
          </section>

          <section className="mc-panel">
            <div className="mc-panel-header">
              <h3>Daily insight</h3>
              <p>{panel.dailyInsight.date}</p>
            </div>
            <div className="mc-insight-block">
              <h4>Action</h4>
              <p>{panel.dailyInsight.action}</p>
              <p className="muted">{panel.dailyInsight.reason}</p>
            </div>
          </section>
        </>
      )}

      {activeTab === 'training' && (
        <>
          <section className="mc-panel">
            <div className="mc-panel-header">
              <h3>Exercise PRs</h3>
              <div className="filter-bar">
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSplitFilter('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'push' ? 'is-active' : ''}`}
                  onClick={() => setSplitFilter('push')}
                >
                  Push
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'pull' ? 'is-active' : ''}`}
                  onClick={() => setSplitFilter('pull')}
                >
                  Pull
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'legs' ? 'is-active' : ''}`}
                  onClick={() => setSplitFilter('legs')}
                >
                  Legs
                </button>
              </div>
            </div>
            <div className="pr-filters">
              <input
                type="search"
                placeholder="Search exercise..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                className="search-input"
              />
              <input
                type="number"
                placeholder="Min weight (kg)"
                value={prMinWeight}
                onChange={(e) => setPrMinWeight(e.target.value)}
                className="search-input"
              />
            </div>
            <table className="mc-compact-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Weight (kg)</th>
                  <th>Date</th>
                  <th>Split</th>
                </tr>
              </thead>
              <tbody>
                {filteredPRs.length > 0 ? (
                  filteredPRs.map((pr, idx) => (
                    <tr key={idx}>
                      <td>{pr.exercise}</td>
                      <td>{pr.weight}</td>
                      <td>{formatDate(pr.date)}</td>
                      <td>
                        <span className={`mc-chip mc-chip--${pr.type === 'push' ? 'blue' : pr.type === 'pull' ? 'purple' : pr.type === 'legs' ? 'green' : ''}`}>
                          {capitalize(pr.type)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="muted">No PRs recorded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="mc-panel">
            <div className="mc-panel-header">
              <h3>Training log</h3>
              <div className="filter-bar">
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => { setSplitFilter('all'); setTrainingPage(1); }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'push' ? 'is-active' : ''}`}
                  onClick={() => { setSplitFilter('push'); setTrainingPage(1); }}
                >
                  Push
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'pull' ? 'is-active' : ''}`}
                  onClick={() => { setSplitFilter('pull'); setTrainingPage(1); }}
                >
                  Pull
                </button>
                <button
                  type="button"
                  className={`action-button ${splitFilter === 'legs' ? 'is-active' : ''}`}
                  onClick={() => { setSplitFilter('legs'); setTrainingPage(1); }}
                >
                  Legs
                </button>
              </div>
            </div>
            <div className="pr-filters">
              <input
                type="date"
                value={trainingDateFrom}
                onChange={(e) => { setTrainingDateFrom(e.target.value); setTrainingPage(1); }}
                className="search-input"
                placeholder="From date"
              />
              <input
                type="date"
                value={trainingDateTo}
                onChange={(e) => { setTrainingDateTo(e.target.value); setTrainingPage(1); }}
                className="search-input"
                placeholder="To date"
              />
            </div>
            <table className="mc-compact-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Split</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorkouts.length > 0 ? (
                  paginatedWorkouts.map((log, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(log.date)}</td>
                      <td>
                        <span className={`mc-chip mc-chip--${log.type === 'push' ? 'blue' : log.type === 'pull' ? 'purple' : log.type === 'legs' ? 'green' : ''}`}>
                          {capitalize(log.type)}
                        </span>
                      </td>
                      <td className="muted">{log.notes ?? '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="muted">No workouts logged yet</td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalTrainingPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  className="action-button"
                  disabled={trainingPage === 1}
                  onClick={() => setTrainingPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="muted">Page {trainingPage} of {totalTrainingPages}</span>
                <button
                  type="button"
                  className="action-button"
                  disabled={trainingPage === totalTrainingPages}
                  onClick={() => setTrainingPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'food' && (
        <section className="mc-panel">
          <div className="mc-panel-header">
            <h3>Food Log</h3>
          </div>
          <table className="mc-compact-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meals</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFoodLog.length > 0 ? (
                <>
                  {(() => {
                    const groupedByDate: Record<string, typeof panel.foodLog> = {}
                    for (const meal of paginatedFoodLog) {
                      if (!groupedByDate[meal.date]) {
                        groupedByDate[meal.date] = []
                      }
                      groupedByDate[meal.date].push(meal)
                    }
                    return Object.entries(groupedByDate).map(([date, meals]) => (
                      <tr 
                        key={date} 
                        onClick={() => setSelectedFoodDate({ date, meals })}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatDate(date)}</td>
                        <td>
                          {meals.map((m) => capitalize(m.mealType)).join(', ')}
                        </td>
                      </tr>
                    ))
                  })()}
                </>
              ) : (
                <tr>
                  <td colSpan={2} className="muted">No meals logged yet</td>
                </tr>
              )}
            </tbody>
          </table>
          {totalFoodPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="action-button"
                disabled={foodPage === 1}
                onClick={() => setFoodPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="muted">Page {foodPage} of {totalFoodPages}</span>
              <button
                type="button"
                className="action-button"
                disabled={foodPage === totalFoodPages}
                onClick={() => setFoodPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
            )}
        </section>
      )}

      {selectedFoodDate && (
        <div className="modal-overlay" onClick={() => setSelectedFoodDate(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Food Log - {formatDate(selectedFoodDate.date)}</h2>
              <button type="button" className="action-button" onClick={() => setSelectedFoodDate(null)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="muted" style={{ marginBottom: '12px' }}>
                {selectedFoodDate.meals[0]?.loggedAt 
                  ? `Logged at ${new Date(selectedFoodDate.meals[0].loggedAt).toLocaleString()}` 
                  : ''}
              </p>
              <table className="mc-compact-table">
                <thead>
                  <tr>
                    <th>Meal</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFoodDate.meals.map((meal, idx) => (
                    <tr key={idx}>
                      <td style={{ textTransform: 'capitalize' }}>{capitalize(meal.mealType)}</td>
                      <td>{meal.items}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
