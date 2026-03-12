import { useMemo, useState } from 'react'
import { useDashboard } from '../context/useDashboard'
import type { RiskSeverity } from '../types'

const riskOrder: Record<RiskSeverity, number> = {
  critical: 0,
  high: 1,
  med: 2,
  low: 3,
}

export function RisksPage() {
  const { data } = useDashboard()
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | 'all'>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  const risks = useMemo(() => data?.risks ?? [], [data?.risks])

  const departmentOptions = useMemo(() => ['all', ...new Set(risks.map((risk) => risk.departmentName))], [risks])

  const filtered = useMemo(
    () =>
      risks
        .filter((risk) => (severityFilter === 'all' ? true : risk.severity === severityFilter))
        .filter((risk) => (departmentFilter === 'all' ? true : risk.departmentName === departmentFilter))
        .sort((a, b) => {
          const severityDiff = riskOrder[a.severity] - riskOrder[b.severity]
          if (severityDiff !== 0) return severityDiff
          return a.dueDate.localeCompare(b.dueDate)
        }),
    [risks, severityFilter, departmentFilter],
  )

  if (!data) return null

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>Risk Register</h1>
        <p>{filtered.length} records</p>
      </div>

      <div className="filters-row">
        <label>
          Severity
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as RiskSeverity | 'all')}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="med">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label>
          Department
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department === 'all' ? 'All' : department}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="risk-list spaced-list">
        {filtered.map((risk) => (
          <li key={risk.id}>
            <div>
              <p className="risk-title">{risk.title}</p>
              <p className="risk-meta">
                {risk.departmentName} • {risk.owner} • {risk.state} • due {risk.dueDate}
              </p>
              <p>{risk.mitigation}</p>
            </div>
            <span className={`pill ${risk.severity === 'critical' || risk.severity === 'high' ? 'red' : 'amber'}`}>
              {risk.severity.toUpperCase()}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
