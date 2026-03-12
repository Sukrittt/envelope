import { useMemo, useState } from 'react'
import { useDashboard } from '../context/useDashboard'

export function LearningsPage() {
  const { data } = useDashboard()
  const [tagFilter, setTagFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  const learnings = useMemo(() => data?.learnings ?? [], [data?.learnings])

  const tags = useMemo(() => ['all', ...new Set(learnings.flatMap((item) => item.tags))], [learnings])
  const departments = useMemo(() => ['all', ...new Set(learnings.map((item) => item.departmentName))], [learnings])

  const filtered = useMemo(
    () =>
      learnings.filter((entry) => {
        const departmentOk = departmentFilter === 'all' || entry.departmentName === departmentFilter
        const tagOk = tagFilter === 'all' || entry.tags.includes(tagFilter)
        return departmentOk && tagOk
      }),
    [learnings, departmentFilter, tagFilter],
  )

  if (!data) return null

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>Learnings</h1>
        <p>{filtered.length} entries</p>
      </div>

      <div className="filters-row">
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

        <label>
          Tag
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag === 'all' ? 'All' : `#${tag}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="learning-list">
        {filtered.map((entry) => (
          <article key={entry.id} className="learning-item">
            <div className="learning-top">
              <strong>{entry.title}</strong>
              <span>
                {entry.departmentName} • {entry.time} • {entry.author}
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
    </section>
  )
}
