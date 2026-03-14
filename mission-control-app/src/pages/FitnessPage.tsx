import fitnessContract from '../data/fitnessDashboard.sample.json'
import { SparkBars } from '../components/SparkBars'
import { toFitnessDashboardPanel } from '../services/fitnessDashboardAdapter'

const panel = toFitnessDashboardPanel(fitnessContract)

function trendTone(value: number) {
  if (value < 0) return 'green'
  if (value > 0) return 'amber'
  return ''
}

export function FitnessPage() {
  return (
    <section className="mc-content-grid fitness-view">
      <section className="headline">
        <div>
          <h1>Fitness Dashboard</h1>
          <p className="muted">Updated {panel.lastUpdated}</p>
        </div>
        <span className="mc-chip mc-chip--green">{panel.remainingKg.toFixed(1)} kg to target</span>
      </section>

      <section className="mc-kpi-strip" aria-label="Fitness KPIs">
        <article className="mc-kpi-card">
          <p>Current Weight</p>
          <strong>{panel.currentWeightKg.toFixed(1)} kg</strong>
          <span className="muted">Target {panel.targetWeightKg.toFixed(1)} kg</span>
        </article>
        <article className="mc-kpi-card">
          <p>Adherence</p>
          <strong className="green">{panel.adherencePct.toFixed(1)}%</strong>
          <span className="muted">Week execution quality</span>
        </article>
        <article className="mc-kpi-card">
          <p>Training completion</p>
          <strong>{panel.trainingCompletionPct.toFixed(0)}%</strong>
          <span className="muted">Workout streak: {panel.workoutStreakDays} days</span>
        </article>
        <article className="mc-kpi-card">
          <p>Protein avg</p>
          <strong>{panel.avgProteinG.toFixed(1)} g</strong>
          <span className="muted">Target {panel.proteinTargetG} g</span>
        </article>
      </section>

      <section className="mc-main-panels">
        <article className="mc-panel">
          <div className="mc-panel-header">
            <h3>Nutrition compliance (7d)</h3>
            <p>Calorie range + protein consistency</p>
          </div>

          <div className="fitness-split-grid">
            <div className="fitness-stat">
              <span className="muted">Calorie hit days</span>
              <strong>{panel.nutritionCompliance.hitDays7d}/7</strong>
            </div>
            <div className="fitness-stat">
              <span className="muted">Calorie miss days</span>
              <strong>{panel.nutritionCompliance.missDays7d}/7</strong>
            </div>
            <div className="fitness-stat">
              <span className="muted">Protein consistency</span>
              <strong className={panel.nutritionCompliance.proteinConsistencyBand === 'high' ? 'green' : 'amber'}>
                {panel.nutritionCompliance.proteinConsistencyBand}
              </strong>
            </div>
            <div className="fitness-stat">
              <span className="muted">Calories avg</span>
              <strong>
                {panel.caloriesAvg} ({panel.caloriesBand.min}-{panel.caloriesBand.max})
              </strong>
            </div>
          </div>

          <SparkBars data={panel.stepsSeries} formatValue={(value) => `${value.toFixed(0)} steps`} />
        </article>

        <article className="mc-panel">
          <div className="mc-panel-header">
            <h3>Training detail lite</h3>
            <p>Split, top set, PR</p>
          </div>

          <div className="mc-summary-row">
            <span className="mc-chip">Push {panel.trainingDetail.splitCounts7d.push}</span>
            <span className="mc-chip">Pull {panel.trainingDetail.splitCounts7d.pull}</span>
            <span className="mc-chip">Legs {panel.trainingDetail.splitCounts7d.legs}</span>
            <span className="mc-chip">Rest {panel.trainingDetail.splitCounts7d.rest}</span>
          </div>

          <div className="fitness-split-grid">
            <div className="fitness-stat">
              <span className="muted">Latest top set</span>
              <strong>
                {panel.trainingDetail.latestTopSet
                  ? `${panel.trainingDetail.latestTopSet.exercise} ${panel.trainingDetail.latestTopSet.weightKg}kg × ${panel.trainingDetail.latestTopSet.reps}`
                  : '—'}
              </strong>
            </div>
            <div className="fitness-stat">
              <span className="muted">Latest PR</span>
              <strong>
                {panel.trainingDetail.latestPr
                  ? `${panel.trainingDetail.latestPr.exercise} (${panel.trainingDetail.latestPr.value})`
                  : 'No PR captured'}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="mc-kpi-strip" aria-label="Fitness Summary Cards">
        <article className="mc-kpi-card">
          <p>Adherence</p>
          <strong>{panel.summaryCards.adherenceWeekPct}%</strong>
          <span className="muted">Week / Month: {panel.summaryCards.adherenceWeekPct}% / {panel.summaryCards.adherenceMonthPct}%</span>
        </article>
        <article className="mc-kpi-card">
          <p>Trend compare</p>
          <strong className={trendTone(panel.summaryCards.trend7dKgPerWeek)}>{panel.summaryCards.trend7dKgPerWeek} kg/wk</strong>
          <span className="muted">7d vs 14d: {panel.summaryCards.trend7dKgPerWeek} / {panel.summaryCards.trend14dKgPerWeek}</span>
        </article>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-header">
          <h3>Daily insight nudge</h3>
          <p>{panel.dailyInsight.date}</p>
        </div>
        <div className="mc-insight-block">
          <h4>Action</h4>
          <p>{panel.dailyInsight.action}</p>
          <p className="muted">{panel.dailyInsight.reason}</p>
        </div>
      </section>

      <section className="mc-panel">
        <div className="mc-panel-header">
          <h3>Weight trend (7d)</h3>
          <p>Trajectory over the last week</p>
        </div>
        <SparkBars data={panel.weightSeries} formatValue={(value) => `${value.toFixed(1)} kg`} />
      </section>
    </section>
  )
}
