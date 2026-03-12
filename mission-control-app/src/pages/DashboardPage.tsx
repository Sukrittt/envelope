import { useMemo } from 'react'
import { Link } from 'react-router-dom'
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

  if (!data) return null

  return (
    <>
      <section className="headline">
        <div>
          <h1>Mission Control Dashboard</h1>
          <p>{data.dateLabel}</p>
        </div>
        <span className={`pill ${data.overallHealth}`}>Overall Health: {statusLabel[data.overallHealth]}</span>
      </section>

      <section className="kpi-strip" aria-label="KPI strip">
        {data.kpis.map((kpi) => (
          <article key={kpi.label} className="kpi-card">
            <p>{kpi.label}</p>
            <strong className={kpi.tone}>{kpi.value}</strong>
          </article>
        ))}
      </section>

      <section className="department-grid" aria-label="Department cards">
        {data.departments.map((department) => (
          <article key={department.id} className="department-card">
            <div className="department-title">
              <h2>{department.name}</h2>
              <span className={`pill ${department.status}`}>{statusLabel[department.status]}</span>
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

      <section className="main-panels">
        <article className="panel">
          <div className="panel-header">
            <h3>Daily Updates</h3>
            <p>Done / Changed / Next / Risk</p>
          </div>
          <div className="updates-list">
            {data.dailyUpdates.map((update) => (
              <details key={update.departmentId} className="update-item" open={update.departmentId === 'engineering'}>
                <summary>
                  <span>{update.departmentName}</span>
                  <span className={`pill ${update.status}`}>{statusLabel[update.status]}</span>
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

        <article className="panel">
          <div className="panel-header">
            <h3>Critical Risks</h3>
            <p>Sorted by severity and due date</p>
          </div>
          <ul className="risk-list">
            {sortedRisks.map((risk) => (
              <li key={risk.id}>
                <div>
                  <p className="risk-title">{risk.title}</p>
                  <p className="risk-meta">
                    {risk.departmentName} • {risk.owner} • due {risk.dueDate}
                  </p>
                  <p>{risk.mitigation}</p>
                </div>
                <span className={`pill ${risk.severity === 'critical' || risk.severity === 'high' ? 'red' : 'amber'}`}>
                  {risk.severity.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="main-panels">
        <article className="panel">
          <div className="panel-header">
            <h3>Daily Learning Feed</h3>
            <p>Chronological notes from all departments</p>
          </div>
          <div className="learning-list">
            {data.learnings.map((entry) => (
              <article key={entry.id} className="learning-item">
                <div className="learning-top">
                  <strong>{entry.title}</strong>
                  <span>
                    {entry.departmentName} • {entry.time}
                  </span>
                </div>
                <p>{entry.note}</p>
                <div className="tags">
                  {entry.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                  {entry.importance === 'high' && <span className="pin">★ pinned</span>}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h3>Activity Timeline</h3>
            <p>Latest cross-team signal stream</p>
          </div>
          <ul className="timeline-list">
            {data.activities.map((item) => (
              <li key={item.id}>
                <div className={`timeline-dot ${item.type}`} />
                <div>
                  <p className="risk-title">{item.title}</p>
                  <p className="risk-meta">
                    {item.departmentName} • {item.timestamp}
                  </p>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
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
