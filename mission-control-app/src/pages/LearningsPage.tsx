import { useMemo, useState } from 'react'
import { useDashboard } from '../context/useDashboard'

export function LearningsPage() {
  const { data } = useDashboard()
  const [tagFilter, setTagFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [importanceFilter, setImportanceFilter] = useState<'all' | 'normal' | 'high'>('all')

  const learnings = useMemo(() => data?.learnings ?? [], [data?.learnings])

  const tags = useMemo(() => ['all', ...new Set(learnings.flatMap((item) => item.tags))], [learnings])
  const departments = useMemo(() => ['all', ...new Set(learnings.map((item) => item.departmentName))], [learnings])

  const filtered = useMemo(
    () =>
      learnings.filter((entry) => {
        const departmentOk = departmentFilter === 'all' || entry.departmentName === departmentFilter
        const tagOk = tagFilter === 'all' || entry.tags.includes(tagFilter)
        const importanceOk = importanceFilter === 'all' || entry.importance === importanceFilter
        return departmentOk && tagOk && importanceOk
      }),
    [learnings, departmentFilter, tagFilter, importanceFilter],
  )

  if (!data) return null

  return (
    <section className="mc-panel">
      <div className="mc-panel-header">
        <h1>Learnings</h1>
        <p>{filtered.length} entries</p>
      </div>

      <div className="mc-filterbar" aria-label="Learning filters">
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

        <label>
          Importance
          <select value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value as typeof importanceFilter)}>
            <option value="all">All</option>
            <option value="high">High priority</option>
            <option value="normal">Normal</option>
          </select>
        </label>

        <button
          type="button"
          className="action-button"
          onClick={() => {
            setDepartmentFilter('all')
            setTagFilter('all')
            setImportanceFilter('all')
          }}
        >
          Reset
        </button>
      </div>

      {filtered.length ? (
        <div className="learning-list">
          {filtered.map((entry) => (
            <article key={entry.id} className={`mc-learning-card ${entry.importance === 'high' ? 'is-high' : ''}`}>
              <div className="learning-top">
                <strong>{entry.title}</strong>
                <span>
                  {entry.departmentName} • {entry.time} • {entry.author}
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
      ) : (
        <div className="state-panel mc-panel">
          <h2>No learnings match current filters</h2>
          <p>Broaden filters to view insights across teams.</p>
          <button
            type="button"
            className="action-button"
            onClick={() => {
              setDepartmentFilter('all')
              setTagFilter('all')
              setImportanceFilter('all')
            }}
          >
            Reset filters
          </button>
        </div>
      )}
    </section>
  )
}
