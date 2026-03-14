import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import expenseSample from '../data/expensePanel.sample.json'
import fitnessContract from '../data/fitnessDashboard.sample.json'
import { SparkBars } from '../components/SparkBars'
import { toExpensePanelData } from '../services/expensePanelAdapter'
import { toFitnessDashboardPanel } from '../services/fitnessDashboardAdapter'
import { PageSectionHeader } from '../components/PageSectionHeader'
import { StatusChip } from '../components/StatusChip'
import { TimelineList } from '../components/TimelineList'
import { useDashboard } from '../context/useDashboard'
import type { RiskSeverity, Status } from '../types'

const statusLabel: Record<Status, string> = {
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
}

const riskOrder: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
}

export function DashboardPage() {
  const { data } = useDashboard()

  const sortedRisks = useMemo(
    () =>
      [...(data?.risks ?? [])].sort((a, b) => {
        const severityDiff = riskOrder[a.severity] - riskOrder[b.severity]
        if (severityDiff !== 0) return severityDiff
        return a.dueDate.localeCompare(b.dueDate)
      }),
    [data?.risks],
  )

  const expensePanel = toExpensePanelData(expenseSample)
  const fitnessPanel = toFitnessDashboardPanel(fitnessContract)

  if (!data) return null

  return (
    <>
      <section className="headline" aria-label="Dashboard date and overall status">
        <div>
          <h1>Mission Control Overview</h1>
          <p className="muted">{data.dateLabel}</p>
        </div>
        <StatusChip label={`Overall Health: ${statusLabel[data.overallHealth]}`} tone={data.overallHealth} />
      </section>

      <section className="mc-kpi-strip" aria-label="KPI strip">
        {data.kpis.map((kpi) => (
          <article key={kpi.label} className="mc-kpi-card">
            <p>{kpi.label}</p>
            <strong className={kpi.tone}>{kpi.value}</strong>
          </article>
        ))}
      </section>

      <section className="mc-card-grid mc-department-grid" aria-label="Department cards">
        {data.departments.map((department) => (
          <article key={department.id} className={`mc-department-card status-${department.status}`}>
            <div className="department-title">
              <h2>{department.name}</h2>
              <StatusChip label={statusLabel[department.status]} tone={department.status} />
            </div>
            <p>Lead: {department.lead}</p>
            <p>Last update: {department.lastUpdate}</p>
            <div className="department-meta">
              <span>{department.activeInitiatives} active initiatives</span>
              <span>{department.openRisks} open risks</span>
            </div>
            <Link className="inline-link" to={`/departments/${department.id}`}>
              Open details →
            </Link>
          </article>
        ))}
      </section>

      <section className="mc-main-panels" aria-label="Primary operations panels">
        <article className="mc-panel" aria-label="Daily updates panel">
          <PageSectionHeader title="Daily Updates" subtitle="Done / Changed / Next / Risk" />
          <div className="updates-list">
            {data.dailyUpdates.map((update) => (
              <details key={update.departmentId} className="mc-accordion-item" open={update.departmentId === 'engineering'}>
                <summary>
                  <span>{update.departmentName}</span>
                  <div className="summary-end">
                    <StatusChip label={statusLabel[update.status]} tone={update.status} />
                    <span className="chevron" aria-hidden="true">
                      ▾
                    </span>
                  </div>
                </summary>
                <div className="update-body">
                  <UpdateList title="Done" items={update.done} />
                  <UpdateList title="Changed" items={update.changed} />
                  <UpdateList title="Next" items={update.next} />
                  <UpdateList title="Risk" items={update.risk} />
                </div>
              </details>
            ))}
          </div>
        </article>

        <article className="mc-panel" aria-label="Critical risks panel">
          <PageSectionHeader title="Critical Risks" subtitle="Sorted by severity and due date" />
          <ul className="risk-list">
            {sortedRisks.map((risk) => {
              const urgency = getDueUrgency(risk.dueDate)
              return (
                <li key={risk.id} className={`mc-risk-row severity-${risk.severity}`}>
                  <div>
                    <p className="risk-title">{risk.title}</p>
                    <p className="risk-meta">
                      {risk.departmentName} • {risk.owner} • due {risk.dueDate}
                    </p>
                    <p className="clamp-2">{risk.mitigation}</p>
                  </div>
                  <div className="risk-right">
                    <StatusChip label={risk.severity.toUpperCase()} tone={risk.severity} />
                    <StatusChip label={urgency.label} tone={urgency.tone} />
                  </div>
                </li>
              )
            })}
          </ul>
        </article>
      </section>

      <section className="mc-main-panels" aria-label="Expense and fitness integration">
        <article className="mc-panel" aria-label="Expense integration snapshot">
          <PageSectionHeader title="Expense Snapshot" subtitle="Run-rate, pressure categories, and direct handoff" />
          <section className="mc-kpi-strip mc-kpi-strip--stack">
            <article className="mc-kpi-card">
              <p>Spend vs cap</p>
              <strong className={expensePanel.runRateStatus === 'overshoot' ? 'red' : expensePanel.runRateStatus === 'watch' ? 'amber' : 'green'}>
                ₹{expensePanel.monthSpendInr.toFixed(0)} / ₹{expensePanel.monthlySpendCapInr.toFixed(0)}
              </strong>
              <span className="muted">{expensePanel.spendVsCapPct}% used • 7d trend {expensePanel.trendPct > 0 ? '+' : ''}{expensePanel.trendPct}%</span>
            </article>
          </section>
          <SparkBars data={expensePanel.miniTrend.slice(-7)} formatValue={(value) => `₹${value.toFixed(0)}`} />
          <div className="tags">
            <span className="mc-chip mc-chip--amber">Dues receivable: ₹{expensePanel.duesReceivableInr.toFixed(2)}</span>
            <Link className="inline-link" to="/expense">
              Open Expense Control →
            </Link>
            <a className="inline-link" href="../expense-dashboard/" target="_blank" rel="noreferrer">
              Launch full Expense dashboard ↗
            </a>
          </div>
        </article>

        <article className="mc-panel" aria-label="Fitness integration snapshot">
          <PageSectionHeader title="Fitness Snapshot" subtitle="Weight trend, adherence, and training pace" />
          <section className="mc-kpi-strip mc-kpi-strip--stack">
            <article className="mc-kpi-card">
              <p>Target progress</p>
              <strong className="green">{fitnessPanel.currentWeightKg.toFixed(1)} kg → {fitnessPanel.targetWeightKg.toFixed(1)} kg</strong>
              <span className="muted">{fitnessPanel.remainingKg.toFixed(1)} kg remaining • adherence {fitnessPanel.adherencePct.toFixed(1)}%</span>
            </article>
          </section>
          <SparkBars data={fitnessPanel.weightSeries} formatValue={(value) => `${value.toFixed(1)} kg`} />
          <div className="tags">
            <span className="mc-chip mc-chip--green">Protein {fitnessPanel.avgProteinG.toFixed(1)}g / {fitnessPanel.proteinTargetG}g</span>
            <span className="mc-chip mc-chip--green">Steps {fitnessPanel.avgSteps.toLocaleString()} avg</span>
            <Link className="inline-link" to="/fitness">
              Open Fitness board →
            </Link>
          </div>
        </article>
      </section>

      <section className="mc-main-panels" aria-label="Context modules">
        <article className="mc-panel" aria-label="Learning feed">
          <PageSectionHeader title="Daily Learning Feed" subtitle="Chronological notes from all departments" />
          <div className="learning-list">
            {data.learnings.map((entry) => (
              <article key={entry.id} className={`mc-learning-card ${entry.importance === 'high' ? 'is-high' : ''}`}>
                <div className="learning-top">
                  <strong>{entry.title}</strong>
                  <span>
                    {entry.departmentName} • {entry.time}
                  </span>
                </div>
                <p>{entry.note}</p>
                <div className="tags">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="mc-chip">
                      #{tag}
                    </span>
                  ))}
                  {entry.importance === 'high' && <span className="mc-chip pin">★ Pinned</span>}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="mc-panel" aria-label="Activity timeline">
          <PageSectionHeader title="Activity Timeline" subtitle="Latest cross-team signal stream" />
          <TimelineList items={data.activities} />
        </article>
      </section>
    </>
  )
}

function UpdateList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function getDueUrgency(dueDate: string): { label: string; tone: 'overdue' | 'soon' | 'planned' } {
  const now = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { label: 'Overdue', tone: 'overdue' }
  if (diffDays <= 3) return { label: 'Due soon', tone: 'soon' }
  return { label: 'Planned', tone: 'planned' }
}
