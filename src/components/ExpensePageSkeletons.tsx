import Link from "next/link";
import { LoadingCaption } from "./LoadingCaption";

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

      <div className="erd-mobile-stats" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="erd-mstat">
            <span
              className="erd-skeleton"
              style={{
                width: "76px",
                height: "10px",
                borderRadius: "5px",
                display: "block",
              }}
            />
            <strong
              className="erd-skeleton"
              style={{
                width: "96px",
                height: "22px",
                borderRadius: "7px",
                marginTop: "10px",
                display: "block",
              }}
            />
          </div>
        ))}
      </div>

      <div className="erd-main">
        {/* ── Sidebar skeleton ── */}
        <nav className="erd-sidebar" aria-hidden="true">
          <div>
            <div
              className="erd-skeleton"
              style={{ width: "120px", height: "22px", borderRadius: "8px" }}
            />
            <div
              className="erd-skeleton"
              style={{
                width: "150px",
                height: "12px",
                borderRadius: "6px",
                marginTop: "10px",
              }}
            />
          </div>

          <div className="erd-summary-box">
            {[0, 1, 2].map((i) => (
              <div key={i} className="erd-summary-row">
                <span
                  className="erd-skeleton"
                  style={{
                    width: "52px",
                    height: "11px",
                    borderRadius: "5px",
                  }}
                />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "66px",
                    height: "11px",
                    borderRadius: "5px",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="erd-nav-group">
            <div className="erd-nav-label">
              <span
                className="erd-skeleton"
                style={{
                  width: "40px",
                  height: "9px",
                  borderRadius: "4px",
                  display: "block",
                }}
              />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="erd-nav-item">
                <span className="erd-nav-dot erd-skeleton" />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "88px",
                    height: "12px",
                    borderRadius: "6px",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="erd-nav-group">
            <div className="erd-nav-label">
              <span
                className="erd-skeleton"
                style={{
                  width: "64px",
                  height: "9px",
                  borderRadius: "4px",
                  display: "block",
                }}
              />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="erd-nav-item">
                <span className="erd-nav-dot erd-skeleton" />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "80px",
                    height: "12px",
                    borderRadius: "6px",
                  }}
                />
              </div>
            ))}
          </div>

          <div className="erd-sidebar-foot">
            <span
              className="erd-skeleton"
              style={{
                width: "140px",
                height: "10px",
                borderRadius: "5px",
                display: "block",
              }}
            />
          </div>
        </nav>

        {/* ── Main content skeleton ── */}
        <div className="erd-content">
          <div className="erd-left-col">
            {/* Scope bar */}
            <section className="erd-card erd-scopebar" aria-hidden="true">
              {[
                "Last 7 days",
                "Last 30 days",
                "Month to date",
                "Custom range",
              ].map((label) => (
                <span
                  key={label}
                  className="erd-skeleton"
                  style={{
                    width: "92px",
                    height: "32px",
                    borderRadius: "100px",
                  }}
                />
              ))}
              <div className="erd-scope-spacer" />
              <div className="erd-scope-meta">
                <span
                  className="erd-skeleton"
                  style={{
                    width: "110px",
                    height: "11px",
                    borderRadius: "5px",
                  }}
                />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "86px",
                    height: "30px",
                    borderRadius: "100px",
                  }}
                />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "112px",
                    height: "36px",
                    borderRadius: "100px",
                  }}
                />
              </div>
            </section>

            {/* Spending trend */}
            <article className="erd-card erd-trend-panel">
              <div className="erd-panel-head">
                <div className="erd-panel-title">
                  <div>
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "130px",
                        height: "18px",
                        borderRadius: "7px",
                      }}
                    />
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "160px",
                        height: "12px",
                        borderRadius: "6px",
                        marginTop: "6px",
                      }}
                    />
                  </div>
                </div>
                <div className="erd-panel-tools">
                  {["Area", "Bars", "Daily", "Weekly", "Monthly"].map(
                    (label) => (
                      <span
                        key={label}
                        className="erd-skeleton"
                        style={{
                          width: "54px",
                          height: "30px",
                          borderRadius: "100px",
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "6px",
                  height: "260px",
                  padding: "16px 0 8px",
                }}
              >
                {[45, 70, 35, 90, 55, 80, 40, 62, 48, 76, 30, 68].map(
                  (h, i) => (
                    <span
                      key={i}
                      className="erd-skeleton"
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        borderRadius: "8px 8px 0 0",
                      }}
                    />
                  ),
                )}
              </div>
            </article>

            {/* Envelopes */}
            <article className="erd-card erd-envelopes-panel">
              <div className="erd-panel-head">
                <div className="erd-panel-title">
                  <div>
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "96px",
                        height: "18px",
                        borderRadius: "7px",
                      }}
                    />
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "150px",
                        height: "12px",
                        borderRadius: "6px",
                        marginTop: "6px",
                      }}
                    />
                  </div>
                </div>
                <span
                  className="erd-skeleton"
                  style={{
                    width: "66px",
                    height: "30px",
                    borderRadius: "100px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  marginTop: "10px",
                }}
              >
                <span
                  className="erd-skeleton"
                  style={{
                    width: "220px",
                    height: "34px",
                    borderRadius: "100px",
                  }}
                />
                <span
                  className="erd-skeleton"
                  style={{
                    width: "150px",
                    height: "34px",
                    borderRadius: "100px",
                  }}
                />
              </div>
              <div className="erd-table-wrap">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: "13px 0",
                      borderBottom: "1px solid var(--erd-border)",
                    }}
                  >
                    <span
                      className="erd-skeleton"
                      style={{
                        width: "110px",
                        height: "12px",
                        borderRadius: "6px",
                      }}
                    />
                    <span
                      className="erd-skeleton"
                      style={{
                        flex: 1,
                        maxWidth: "220px",
                        height: "6px",
                        borderRadius: "100px",
                      }}
                    />
                    <span
                      className="erd-skeleton"
                      style={{
                        width: "62px",
                        height: "12px",
                        borderRadius: "6px",
                      }}
                    />
                    <span
                      className="erd-skeleton"
                      style={{
                        width: "62px",
                        height: "12px",
                        borderRadius: "6px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </article>

            {/* Subscriptions */}
            <article className="erd-card erd-subs-panel">
              <div className="erd-panel-head">
                <div className="erd-panel-title">
                  <div>
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "112px",
                        height: "18px",
                        borderRadius: "7px",
                      }}
                    />
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "150px",
                        height: "12px",
                        borderRadius: "6px",
                        marginTop: "6px",
                      }}
                    />
                  </div>
                </div>
                <span
                  className="erd-skeleton"
                  style={{
                    width: "62px",
                    height: "30px",
                    borderRadius: "100px",
                  }}
                />
              </div>
              <div className="erd-subs-totals" style={{ marginTop: "12px" }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="erd-skeleton"
                    style={{
                      width: "64px",
                      height: "12px",
                      borderRadius: "6px",
                    }}
                  />
                ))}
              </div>
              <div className="erd-subs-list">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="erd-subs-item">
                    <div className="erd-subs-item-row">
                      <span
                        className="erd-skeleton"
                        style={{
                          width: "96px",
                          height: "12px",
                          borderRadius: "6px",
                        }}
                      />
                      <span
                        className="erd-skeleton"
                        style={{
                          width: "70px",
                          height: "12px",
                          borderRadius: "6px",
                        }}
                      />
                    </div>
                    <div className="erd-subs-item-track">
                      <span
                        className="erd-skeleton"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "6px",
                          borderRadius: "100px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="erd-right-col">
            {/* RTA hero — the income-card skeleton this used to pair with had
               no counterpart in the loaded page, so it isn't reproduced here. */}
            <div className="erd-hero-row">
              <div className="erd-card erd-rta-hero">
                <LoadingCaption className="loading-caption-inline" />
                <div
                  className="erd-skeleton"
                  style={{
                    width: "210px",
                    height: "46px",
                    borderRadius: "12px",
                    marginTop: "10px",
                  }}
                />
                <div
                  className="erd-skeleton"
                  style={{
                    width: "100%",
                    height: "8px",
                    borderRadius: "100px",
                    marginTop: "20px",
                  }}
                />
                <div
                  className="erd-skeleton"
                  style={{
                    width: "56%",
                    height: "12px",
                    borderRadius: "6px",
                    marginTop: "14px",
                  }}
                />
              </div>
            </div>

            <section className="erd-card erd-insights-panel">
              <div
                className="erd-skeleton"
                style={{
                  width: "84px",
                  height: "18px",
                  borderRadius: "7px",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "40%",
                        height: "10px",
                        borderRadius: "5px",
                      }}
                    />
                    <div
                      className="erd-skeleton"
                      style={{
                        width: "100%",
                        height: "10px",
                        borderRadius: "5px",
                        marginTop: "6px",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "4px",
                  marginTop: "18px",
                }}
              >
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className="erd-skeleton"
                    style={{ aspectRatio: "1", borderRadius: "6px" }}
                  />
                ))}
              </div>
            </section>
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
        <button type="button" className="erd-tab" disabled>
          <span aria-hidden="true">🧺</span>
          <span>Envelopes</span>
        </button>
        <Link href="/account" className="erd-tab">
          <span aria-hidden="true">⚙️</span>
          <span>More</span>
        </Link>
      </nav>
    </section>
  );
}
