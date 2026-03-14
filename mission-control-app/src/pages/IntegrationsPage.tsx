import { useDashboard } from '../context/useDashboard'

export function IntegrationsPage() {
  const { data } = useDashboard()
  if (!data) return null

  return (
    <section className="mc-content-grid">
      <article className="mc-panel">
        <div className="mc-panel-header">
          <h1>Integrations</h1>
          <p>External modules and linkage health</p>
        </div>

        <div className="mc-card-grid">
          {data.externalModules.map((module) => (
            <article key={module.module} className="mc-panel mc-integration-card">
              <div className="department-title">
                <h3>{module.title}</h3>
                <span className={`mc-chip mc-chip--${module.health}`}>{module.health.toUpperCase()}</span>
              </div>
              <p className="muted">Last sync: {module.lastSync}</p>
              <p>{module.primaryMetric}</p>
              <p className="muted">{module.secondaryMetric}</p>
              <div className="tags">
                {module.deepLinks.map((link) => (
                  <a key={link.label} href={link.url} className="inline-link" target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
              <p>{module.notes}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="mc-panel">
        <div className="mc-panel-header">
          <h3>Cross-department sync</h3>
          <p>Current owners, blockers, and next actions</p>
        </div>

        <div className="mc-sync-list">
          {data.crossDepartmentSync.map((row) => (
            <article key={row.department} className="mc-sync-row">
              <div>
                <p className="risk-title">{row.department}</p>
                <p className="risk-meta">
                  {row.owner} • updated {row.updatedAt}
                </p>
              </div>
              <span className={`mc-chip mc-chip--${row.status}`}>{row.status.toUpperCase()}</span>
              <p className="clamp-2">Block: {row.block}</p>
              <p className="muted">Next: {row.next}</p>
            </article>
          ))}
        </div>
      </article>
    </section>
  )
}
