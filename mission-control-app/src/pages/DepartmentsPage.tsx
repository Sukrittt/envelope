import { Link, useParams } from 'react-router-dom'
import { useDashboard } from '../context/useDashboard'

export function DepartmentsPage() {
  const { data } = useDashboard()
  if (!data) return null

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>Departments</h1>
        <p>Ownership and current operating status</p>
      </div>
      <div className="department-grid" aria-label="Department cards">
        {data.departments.map((department) => (
          <article key={department.id} className="department-card">
            <div className="department-title">
              <h2>{department.name}</h2>
              <span className={`pill ${department.status}`}>{department.status.toUpperCase()}</span>
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
      <section className="state-panel">
        <h2>Department not found</h2>
        <Link to="/departments">Back to departments</Link>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>{department.name}</h1>
        <p>
          Lead: {department.lead} • Last update {department.lastUpdate}
        </p>
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
              <li key={risk.id}>
                <div>
                  <p className="risk-title">{risk.title}</p>
                  <p className="risk-meta">
                    {risk.owner} • due {risk.dueDate} • {risk.state}
                  </p>
                  <p>{risk.mitigation}</p>
                </div>
                <span className={`pill ${risk.severity === 'critical' || risk.severity === 'high' ? 'red' : 'amber'}`}>
                  {risk.severity.toUpperCase()}
                </span>
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
