import { Link, useParams } from 'react-router-dom'
import { StatusChip } from '../components/StatusChip'
import { useDashboard } from '../context/useDashboard'

export function DepartmentsPage() {
  const { data } = useDashboard()
  if (!data) return null

  const counts = data.departments.reduce(
    (acc, department) => {
      acc.total += 1
      acc[department.status] += 1
      return acc
    },
    { total: 0, green: 0, amber: 0, red: 0 },
  )

  return (
    <section className="mc-panel" aria-label="Department status overview">
      <div className="mc-panel-header">
        <h1>Departments</h1>
        <p>Ownership and current operating status</p>
      </div>

      <div className="mc-summary-row" aria-label="Department summary">
        <StatusChip label={`${counts.total} teams`} tone="green" />
        <StatusChip label={`${counts.green} green`} tone="green" />
        <StatusChip label={`${counts.amber} amber`} tone="amber" />
        <StatusChip label={`${counts.red} red`} tone="red" />
      </div>

      <div className="mc-card-grid mc-department-grid" aria-label="Department cards">
        {data.departments.map((department) => (
          <article key={department.id} className={`mc-department-card status-${department.status}`}>
            <div className="department-title">
              <h2>{department.name}</h2>
              <StatusChip label={department.status.toUpperCase()} tone={department.status} />
            </div>
            <p>Lead: {department.lead}</p>
            <p>Last update: {department.lastUpdate}</p>
            <div className="department-meta">
              <span>{department.activeInitiatives} active initiatives</span>
              <span>{department.openRisks} open risks</span>
            </div>
            <Link className="inline-link" to={`/departments/${department.id}`}>
              View department update →
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}

export function DepartmentDetailPage() {
  const { data } = useDashboard()
  const { departmentId } = useParams()

  if (!data || !departmentId) return null

  const department = data.departments.find((item) => item.id === departmentId)
  const update = data.dailyUpdates.find((item) => item.departmentId === departmentId)
  const risks = data.risks.filter((item) =>
    item.departmentName.toLowerCase().includes((department?.name ?? '').toLowerCase()),
  )

  if (!department || !update) {
    return (
      <section className="state-panel mc-panel">
        <h2>Department not found</h2>
        <Link className="inline-link" to="/departments">
          Back to departments
        </Link>
      </section>
    )
  }

  return (
    <section className="mc-panel" aria-label={`${department.name} details`}>
      <div className="mc-sticky-mini-header">
        <div>
          <h1>{department.name}</h1>
          <p>
            Lead: {department.lead} • Last update {department.lastUpdate}
          </p>
        </div>
        <StatusChip label={department.status.toUpperCase()} tone={department.status} />
      </div>

      <div className="update-body">
        <DetailList title="Done" items={update.done} />
        <DetailList title="Changed" items={update.changed} />
        <DetailList title="Next" items={update.next} />
        <DetailList title="Risk" items={update.risk} />
      </div>

      <div>
        <h3>Department risk register</h3>
        <ul className="risk-list spaced-list">
          {risks.length ? (
            risks.map((risk) => (
              <li key={risk.id} className={`mc-risk-row severity-${risk.severity}`}>
                <div>
                  <p className="risk-title">{risk.title}</p>
                  <p className="risk-meta">
                    {risk.owner} • due {risk.dueDate} • {risk.state}
                  </p>
                  <p className="clamp-2">{risk.mitigation}</p>
                </div>
                <StatusChip label={risk.severity.toUpperCase()} tone={risk.severity} />
              </li>
            ))
          ) : (
            <li>No open risks tracked for this department.</li>
          )}
        </ul>
      </div>

      <Link className="inline-link" to="/departments">
        ← Back to departments
      </Link>
    </section>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
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
