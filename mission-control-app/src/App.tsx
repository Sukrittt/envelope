import { useEffect, useMemo, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { getDashboardData } from './services/dashboardService'
import type { DashboardData, DepartmentSyncStatus, ExternalModuleSummary, RiskItem, RiskSeverity, Status } from './types'

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

const TOP_NAV = [
  { to: '/overview', label: 'Overview' },
  { to: '/expense', label: 'Expense Dashboard' },
  { to: '/fitness', label: 'Fitness Dashboard' },
  { to: '/mission-control', label: 'Mission Control' },
]

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    getDashboardData()
      .then((payload) => {
        if (!active) return
        setData(payload)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
      })

    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <main className="page-shell">
        <h1>Master Dashboard</h1>
        <section className="panel state-panel" role="alert">
          <p className="error">Could not load dashboard data: {error}</p>
          <p>Check API availability or unset VITE_API_BASE_URL to use bundled mock data.</p>
        </section>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="page-shell">
        <h1>Master Dashboard</h1>
        <section className="panel state-panel" aria-busy="true">
          <p>Loading dashboard…</p>
        </section>
      </main>
    )
  }

  const expenseModule = data.externalModules.find((module) => module.module === 'expense')
  const fitnessModule = data.externalModules.find((module) => module.module === 'fitness')

  return (
    <main className="page-shell">
      <header className="top-nav">
        <div>
          <strong>Master Dashboard</strong>
          <p className="muted">Expense + Fitness + Mission Control unified shell</p>
        </div>
        <nav aria-label="Primary dashboard sections">
          {TOP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route
          path="/overview"
          element={<OverviewPage data={data} expenseModule={expenseModule} fitnessModule={fitnessModule} />}
        />
        <Route path="/expense" element={<ModulePage module={expenseModule} title="Expense Dashboard" />} />
        <Route path="/fitness" element={<ModulePage module={fitnessModule} title="Fitness Dashboard" />} />
        <Route path="/mission-control" element={<MissionControlPage data={data} />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </main>
  )
}

function OverviewPage({
  data,
  expenseModule,
  fitnessModule,
}: {
  data: DashboardData
  expenseModule?: ExternalModuleSummary
  fitnessModule?: ExternalModuleSummary
}) {
  return (
    <>
      <section className="headline">
        <div>
          <h1>Overview</h1>
          <p>{data.dateLabel}</p>
        </div>
        <span className={`pill ${data.overallHealth}`}>System health: {statusLabel[data.overallHealth]}</span>
      </section>

      <section className="kpi-strip" aria-label="Overview KPI strip">
        {data.kpis.map((kpi) => (
          <article key={kpi.label} className="kpi-card">
            <p>{kpi.label}</p>
            <strong className={kpi.tone}>{kpi.value}</strong>
          </article>
        ))}
      </section>

      <section className="module-grid" aria-label="Integrated module summaries">
        {expenseModule && <ModuleSummaryCard module={expenseModule} />}
        {fitnessModule && <ModuleSummaryCard module={fitnessModule} />}
      </section>

      <CrossDepartmentSyncPanel entries={data.crossDepartmentSync} />
    </>
  )
}

function ModulePage({ module, title }: { module?: ExternalModuleSummary; title: string }) {
  if (!module) {
    return (
      <section className="panel state-panel">
        <h1>{title}</h1>
        <p className="muted">No module configuration found. Add it in dashboard data bindings.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h1>{module.title}</h1>
        <span className={`pill ${module.health}`}>{statusLabel[module.health]}</span>
      </div>
      <p className="muted">Last sync: {module.lastSync}</p>

      <section className="kpi-strip" aria-label={`${module.title} summary`}>
        <article className="kpi-card">
          <p>Primary metric</p>
          <strong>{module.primaryMetric}</strong>
        </article>
        <article className="kpi-card">
          <p>Status summary</p>
          <strong>{module.secondaryMetric}</strong>
        </article>
      </section>

      <article className="panel nested-panel">
        <div className="panel-header">
          <h3>Integrated module access</h3>
          <p>Deep links to external tools/data</p>
        </div>
        <div className="link-row">
          {module.deepLinks.map((link) => (
            <a key={link.url} className="action-link" href={link.url}>
              {link.label}
            </a>
          ))}
        </div>
        <p>{module.notes}</p>
      </article>
    </section>
  )
}

function MissionControlPage({ data }: { data: DashboardData }) {
  const sortedRisks = useMemo(() => {
    return [...data.risks].sort((a, b) => {
      const severityDiff = riskOrder[a.severity] - riskOrder[b.severity]
      if (severityDiff !== 0) return severityDiff
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [data.risks])

  return (
    <>
      <section className="headline">
        <div>
          <h1>Mission Control</h1>
          <p>Department execution + risk watch</p>
        </div>
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
          <RiskList risks={sortedRisks.slice(0, 6)} />
        </article>
      </section>

      <CrossDepartmentSyncPanel entries={data.crossDepartmentSync} />
    </>
  )
}

function ModuleSummaryCard({ module }: { module: ExternalModuleSummary }) {
  return (
    <article className="panel">
      <div className="panel-header">
        <h3>{module.title}</h3>
        <span className={`pill ${module.health}`}>{statusLabel[module.health]}</span>
      </div>
      <p className="muted">Last sync: {module.lastSync}</p>
      <p>
        <strong>{module.primaryMetric}</strong>
      </p>
      <p>{module.secondaryMetric}</p>
      <div className="link-row">
        {module.deepLinks.map((link) => (
          <a key={link.url} className="action-link" href={link.url}>
            {link.label}
          </a>
        ))}
      </div>
    </article>
  )
}

function CrossDepartmentSyncPanel({ entries }: { entries: DepartmentSyncStatus[] }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Cross-department sync</h3>
        <p>Engineering • UI/UX • Fitness • Ops</p>
      </div>
      <div className="sync-grid" aria-label="Cross-department status blocks">
        {entries.map((entry) => (
          <article key={entry.department} className="sync-card">
            <div className="department-title">
              <strong>{entry.department}</strong>
              <span className={`pill ${entry.status}`}>{statusLabel[entry.status]}</span>
            </div>
            <p className="muted">Owner: {entry.owner}</p>
            <p className="muted">Updated: {entry.updatedAt}</p>
            <p>
              <strong>Block:</strong> {entry.block}
            </p>
            <p>
              <strong>Next:</strong> {entry.next}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

function RiskList({ risks, emptyText = 'No risks available.' }: { risks: RiskItem[]; emptyText?: string }) {
  if (!risks.length) {
    return <p className="muted">{emptyText}</p>
  }

  return (
    <ul className="risk-list">
      {risks.map((risk) => (
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

export default App
