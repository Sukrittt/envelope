import Link from "next/link";
import { LoadingCaption } from "./LoadingCaption";
import { ExpenseSidebar } from "./ExpenseSidebar";

/**
 * Placeholder shell shown while `/expense`'s queries are in flight. Kept as
 * its own component (rather than inline in ExpensePage.tsx) so there's a
 * single loading-shaped tree instead of two full page trees hand-synced by
 * class name.
 */
export function ExpensePageSkeleton() {
  return (
    <section className="expense-redesign" aria-busy="true" aria-live="polite">
      <header className="erd-mobile-header" aria-hidden="true">
        <div
          className="erd-skeleton"
          style={{ width: "132px", height: "22px", borderRadius: "8px" }}
        />
        <div
          className="erd-skeleton"
          style={{
            width: "190px",
            height: "12px",
            borderRadius: "6px",
            marginTop: "12px",
          }}
        />
      </header>

      <div className="erd-main">
        {/* The sidebar has no data dependency, so the real one renders here. */}
        <ExpenseSidebar />
        <div className="erd-content">
          <div className="erd-home">
            <div className="erd-home-main">
              <div className="erd-home-hero">
                <LoadingCaption className="loading-caption-inline" />
                <span className="erd-skeleton" style={{ width: "220px", height: "56px", borderRadius: "14px" }} />
                <span className="erd-skeleton" style={{ width: "160px", height: "12px", borderRadius: "6px" }} />
              </div>
              <article className="erd-card erd-envelopes-panel" aria-hidden="true">
                <span className="erd-skeleton" style={{ display: "block", width: "110px", height: "18px", borderRadius: "7px" }} />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px 0", borderBottom: "1px solid var(--erd-border)" }}>
                    <span className="erd-skeleton" style={{ width: "140px", height: "12px", borderRadius: "6px" }} />
                    <span className="erd-skeleton" style={{ width: "100%", height: "5px", borderRadius: "100px" }} />
                  </div>
                ))}
              </article>
            </div>
            <aside className="erd-home-rail" aria-hidden="true">
              <div className="erd-card erd-income-card">
                <span className="erd-skeleton" style={{ width: "120px", height: "22px", borderRadius: "8px" }} />
                <span className="erd-skeleton" style={{ width: "100%", height: "8px", borderRadius: "100px" }} />
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Static nav, same as the loaded page — it has no data dependency, so
         there's no reason to fake-load it. Log/Envelopes are inert until
         panel data exists. */}
      <nav className="erd-tabbar" aria-label="Primary">
        <Link href="/expense" className="erd-tab">
          <span aria-hidden="true">🏠</span>
          <span>Home</span>
        </Link>
        <Link href="/expense/transactions" className="erd-tab">
          <span aria-hidden="true">🧾</span>
          <span>Activity</span>
        </Link>
        <button type="button" className="erd-tab-fab" disabled aria-label="Log expense">
          +
        </button>
        <Link href="/insights" className="erd-tab">
          <span aria-hidden="true">📊</span>
          <span>Insights</span>
        </Link>
        <Link href="/account" className="erd-tab">
          <span aria-hidden="true">⚙️</span>
          <span>More</span>
        </Link>
      </nav>
    </section>
  );
}
