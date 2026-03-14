import { useMemo, useState } from 'react'
import { TimelineList } from '../components/TimelineList'
import { useDashboard } from '../context/useDashboard'

export function ActivityPage() {
  const { data } = useDashboard()
  const [typeFilter, setTypeFilter] = useState<'all' | 'update' | 'risk' | 'learning'>('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  const departments = useMemo(
    () => ['all', ...new Set((data?.activities ?? []).map((item) => item.departmentName))],
    [data?.activities],
  )

  const filtered = useMemo(
    () =>
      (data?.activities ?? []).filter((item) => {
        const typeOk = typeFilter === 'all' || item.type === typeFilter
        const deptOk = departmentFilter === 'all' || item.departmentName === departmentFilter
        return typeOk && deptOk
      }),
    [data?.activities, typeFilter, departmentFilter],
  )

  const counters = useMemo(
    () => ({
      updates: (data?.activities ?? []).filter((item) => item.type === 'update').length,
      risks: (data?.activities ?? []).filter((item) => item.type === 'risk').length,
      learnings: (data?.activities ?? []).filter((item) => item.type === 'learning').length,
    }),
    [data?.activities],
  )

  if (!data) return null

  return (
    <section className="mc-main-panels mc-main-panels--activity">
      <article className="mc-panel">
        <div className="mc-panel-header">
          <h1>Activity</h1>
          <p>{filtered.length} events in timeline</p>
        </div>

        <div className="mc-filterbar">
          <label>
            Event type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">All</option>
              <option value="update">Update</option>
              <option value="risk">Risk</option>
              <option value="learning">Learning</option>
            </select>
          </label>
          <label>
            Department
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department === 'all' ? 'All' : department}
                </option>
              ))}
            </select>
          </label>
        </div>

        <TimelineList items={filtered} />
      </article>

      <aside className="mc-panel">
        <div className="mc-panel-header">
          <h3>Last 24h Counters</h3>
          <p>Quick monitoring rail</p>
        </div>

        <div className="mc-kpi-strip mc-kpi-strip--stack">
          <article className="mc-kpi-card">
            <p>Update events</p>
            <strong>{counters.updates}</strong>
          </article>
          <article className="mc-kpi-card">
            <p>Risk events</p>
            <strong className="red">{counters.risks}</strong>
          </article>
          <article className="mc-kpi-card">
            <p>Learning pins</p>
            <strong className="amber">{counters.learnings}</strong>
          </article>
        </div>
      </aside>
    </section>
  )
}
