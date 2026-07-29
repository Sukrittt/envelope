import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Settings, Sun, Moon } from "lucide-react";
import "./App.css";
import { DashboardProvider } from "./context/DashboardProvider";
import { useDashboard } from "./context/useDashboard";
import { trackEvent } from "./lib/telemetry";
import { ExpensePage } from "./pages/ExpensePage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { FitnessPage } from "./pages/FitnessPage";
import { LearningsPage } from "./pages/LearningsPage";
import { SettingsPage } from "./pages/SettingsPage";
// import { ModuleSwitcher } from "./components/ModuleSwitcher";

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/expense": {
    title: "Expense Dashboard",
    subtitle: "Run-rate, category pressure, and cashflow guardrails",
  },
  "/expense/transactions": {
    title: "Transactions",
    subtitle: "Timeline of all recorded expenses",
  },
  "/fitness": {
    title: "Fitness Dashboard",
    subtitle: "Body metrics, adherence, and training execution",
  },
  "/learnings": {
    title: "Agent Learnings",
    subtitle: "What each department/agent is learning over time",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Appearance, density, and operations preferences",
  },
};

function AppShell() {
  const { loading, error, reload } = useDashboard();
  const { pathname } = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("mc-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    const saved = localStorage.getItem("mc-density");
    return saved === "compact" ? "compact" : "comfortable";
  });

  const currentMeta = useMemo(
    () => pageMeta[pathname] ?? pageMeta["/expense"],
    [pathname],
  );

  useEffect(() => {
    localStorage.setItem("mc-theme", theme);
    trackEvent("theme_changed", { theme });
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("mc-density", density);
  }, [density]);

  useEffect(() => {
    trackEvent("page_view", { path: pathname });
  }, [pathname]);

  const isExpenseRoute = pathname.startsWith("/expense");

  return (
    <main
      className={`mc-page theme-${theme} density-${density} ${isExpenseRoute ? "expense-shell" : ""}`}
    >
      <div className="mc-layout">
        <section className="mc-main">
          <header className="mc-topbar">
            <div className="page-context">
              <h2>{currentMeta.title}</h2>
              <p>{currentMeta.subtitle}</p>
            </div>
            <div className="utility-cluster">
              <button
                type="button"
                className="action-button"
                onClick={() => {
                  void reload();
                  trackEvent("quick_action_used", { action: "refresh" });
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="action-button theme-toggle"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Link
                to="/settings"
                className="action-button"
                aria-label="Open settings"
                title="Settings"
              >
                <Settings size={18} />
              </Link>
            </div>
          </header>

          {/* <section
            className="mc-shell-context mc-panel"
            aria-label="Master dashboard switcher and shared status"
          >
            <div className="department-title">
              <ModuleSwitcher />
              <div className="mc-summary-row">
                {moduleStatus.map((module) => (
                  <span
                    key={module.label}
                    className={`mc-chip mc-chip--${module.tone}`}
                  >
                    {module.label}: {module.tone.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          </section> */}

          {loading ? (
            <section className="state-panel mc-panel" aria-live="polite">
              <h2>Loading dashboard…</h2>
              <p>Fetching latest mission-control data.</p>
            </section>
          ) : error ? (
            <section className="state-panel mc-panel" aria-live="assertive">
              <h2>Could not load dashboard data</h2>
              <p className="error">{error}</p>
              <button
                type="button"
                className="action-button"
                onClick={() => void reload()}
              >
                Retry
              </button>
            </section>
          ) : (
            <Routes>
              <Route path="/expense/transactions" element={<TransactionsPage />} />
              <Route path="/expense" element={<ExpensePage />} />
              <Route path="/fitness" element={<FitnessPage />} />
              <Route path="/learnings" element={<LearningsPage />} />
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
              <Route path="*" element={<Navigate to="/expense" replace />} />
            </Routes>
          )}
        </section>
      </div>
    </main>
  );
}

function App() {
  return (
    <DashboardProvider>
      <AppShell />
    </DashboardProvider>
  );
}

export default App;
