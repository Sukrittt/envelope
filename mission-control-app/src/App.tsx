import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { DashboardProvider } from './context/DashboardProvider'
import { useDashboard } from './context/useDashboard'
import { DashboardPage } from './pages/DashboardPage'
import { DepartmentDetailPage, DepartmentsPage } from './pages/DepartmentsPage'
import { LearningsPage } from './pages/LearningsPage'
import { RisksPage } from './pages/RisksPage'

function AppShell() {
  const { loading, error, reload } = useDashboard()

  return (
    <main className="page-shell">
      <header className="top-nav">
        <strong>Mission Control</strong>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/departments">Departments</NavLink>
          <NavLink to="/risks">Risks</NavLink>
          <NavLink to="/learnings">Learnings</NavLink>
        </nav>
      </header>

      {loading ? (
        <section className="state-panel">
          <h2>Loading dashboard…</h2>
          <p>Fetching latest mission-control data.</p>
        </section>
      ) : error ? (
        <section className="state-panel">
          <h2>Could not load dashboard data</h2>
          <p className="error">{error}</p>
          <button type="button" onClick={() => void reload()}>
            Retry
          </button>
        </section>
      ) : (
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/departments/:departmentId" element={<DepartmentDetailPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/learnings" element={<LearningsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
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
