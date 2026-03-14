import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import { DashboardProvider } from './context/DashboardProvider'
import { useDashboard } from './context/useDashboard'
import { trackEvent } from './lib/telemetry'
import { navGroups } from './navigation'
import { ActivityPage } from './pages/ActivityPage'
import { DashboardPage } from './pages/DashboardPage'
import { DepartmentDetailPage, DepartmentsPage } from './pages/DepartmentsPage'
import { ExpensePage } from './pages/ExpensePage'
import { FitnessPage } from './pages/FitnessPage'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { LearningsPage } from './pages/LearningsPage'
import { RisksPage } from './pages/RisksPage'
import { SettingsPage } from './pages/SettingsPage'
import { ModuleSwitcher } from './components/ModuleSwitcher'

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Overview', subtitle: 'Cross-team pulse and mission health' },
  '/departments': { title: 'Departments', subtitle: 'Ownership, updates, and execution status' },
  '/expense': { title: 'Expense Dashboard', subtitle: 'Run-rate, category pressure, and cashflow guardrails' },
  '/fitness': { title: 'Fitness Dashboard', subtitle: 'Body metrics, adherence, and training execution' },
  '/risks': { title: 'Risks', subtitle: 'Severity queue, mitigation, and due windows' },
  '/learnings': { title: 'Learnings', subtitle: 'Operational insights and reusable discoveries' },
  '/activity': { title: 'Activity', subtitle: 'Unified timeline across update, risk, and learning events' },
  '/integrations': { title: 'Integrations', subtitle: 'External system health and deep-link access' },
  '/settings': { title: 'Settings', subtitle: 'Appearance, density, and operations preferences' },
}

const navIcons: Record<string, ReactNode> = {
  '/': '◉',
  '/departments': '▦',
  '/risks': '▲',
  '/learnings': '✦',
  '/activity': '◷',
  '/expense': '₹',
  '/fitness': '◍',
  '/integrations': '◎',
  '/settings': '⚙',
}

function AppShell() {
  const { data, loading, error, reload } = useDashboard()
  const { pathname } = useLocation()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mc-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    const saved = localStorage.getItem('mc-density')
    return saved === 'compact' ? 'compact' : 'comfortable'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const currentMeta = useMemo(() => {
    if (pathname.startsWith('/departments/')) {
      return { title: 'Department Detail', subtitle: 'Latest update and risk register' }
    }

    return pageMeta[pathname] ?? pageMeta['/']
  }, [pathname])

  const lastSync = useMemo(() => {
    if (!data) return '—'

    const updateTimes = data.dailyUpdates.map((item) => item.updatedAt).sort()
    return updateTimes.at(-1) ?? data.dateLabel
  }, [data])

  const moduleStatus = useMemo(() => {
    if (!data) return []

    return [
      { label: 'Mission', tone: data.overallHealth },
      ...data.externalModules.map((module) => ({ label: module.module === 'expense' ? 'Expense' : 'Fitness', tone: module.health })),
    ]
  }, [data])

  useEffect(() => {
    localStorage.setItem('mc-theme', theme)
    trackEvent('theme_changed', { theme })
  }, [theme])

  useEffect(() => {
    localStorage.setItem('mc-density', density)
  }, [density])

  useEffect(() => {
    trackEvent('page_view', { path: pathname })
  }, [pathname])

  const isExpenseRoute = pathname === '/expense'

  return (
    <main className={`mc-page theme-${theme} density-${density} ${isExpenseRoute ? 'expense-shell' : ''}`}>
      <div className={`mc-layout ${sidebarCollapsed ? 'is-collapsed' : ''} ${mobileNavOpen ? 'is-mobile-open' : ''}`}>
        <aside className="mc-sidebar" aria-label="Primary Navigation">
          <div className="sidebar-brand">
            <strong>Mission Control</strong>
            <span>Operations Center</span>
          </div>

          <nav>
            {navGroups.map((group) => (
              <section className="sidebar-group" key={group.label} aria-label={group.label}>
                <p className="sidebar-group-label">{group.label}</p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) => (isActive ? 'sidebar-link active' : 'sidebar-link')}
                    aria-label={item.label}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => {
                      trackEvent('nav_click', { target: item.path })
                      setMobileNavOpen(false)
                    }}
                  >
                    <span className="sidebar-link-indicator" aria-hidden="true" />
                    <span className="sidebar-link-icon" aria-hidden="true">{navIcons[item.path] ?? '•'}</span>
                    <span className="sidebar-link-label">{item.label}</span>
                  </NavLink>
                ))}
              </section>
            ))}
          </nav>

          <footer className="sidebar-footer">
            <span className="mc-chip mc-chip--green">System nominal</span>
            <span className="muted">Last sync: {lastSync}</span>
            <button type="button" className="action-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              Toggle theme
            </button>
          </footer>
        </aside>

        <section className="mc-main">
          <header className="mc-topbar">
            <button type="button" className="action-button mobile-only" onClick={() => setMobileNavOpen((value) => !value)}>
              Menu
            </button>
            <div className="page-context">
              <h2>{currentMeta.title}</h2>
              <p>{currentMeta.subtitle}</p>
            </div>
            <div className="utility-cluster">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void reload()
                  trackEvent('quick_action_used', { action: 'refresh' })
                }}
              >
                Refresh
              </button>
              <button type="button" className="action-button" onClick={() => setSidebarCollapsed((value) => !value)}>
                {sidebarCollapsed ? 'Expand' : 'Collapse'} sidebar
              </button>
            </div>
          </header>

          <section className="mc-shell-context mc-panel" aria-label="Master dashboard switcher and shared status">
            <div className="department-title">
              <ModuleSwitcher />
              <div className="mc-summary-row">
                {moduleStatus.map((module) => (
                  <span key={module.label} className={`mc-chip mc-chip--${module.tone}`}>
                    {module.label}: {module.tone.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {loading ? (
            <section className="state-panel mc-panel" aria-live="polite">
              <h2>Loading dashboard…</h2>
              <p>Fetching latest mission-control data.</p>
            </section>
          ) : error ? (
            <section className="state-panel mc-panel" aria-live="assertive">
              <h2>Could not load dashboard data</h2>
              <p className="error">{error}</p>
              <button type="button" className="action-button" onClick={() => void reload()}>
                Retry
              </button>
            </section>
          ) : (
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/departments/:departmentId" element={<DepartmentDetailPage />} />
              <Route path="/expense" element={<ExpensePage />} />
              <Route path="/fitness" element={<FitnessPage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/learnings" element={<LearningsPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    theme={theme}
                    onThemeChange={setTheme}
                    density={density}
                    onDensityChange={setDensity}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </section>
      </div>
    </main>
  )
}

function App() {
  return (
    <DashboardProvider>
      <AppShell />
    </DashboardProvider>
  )
}

export default App
