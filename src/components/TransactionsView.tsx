import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  loadTransactions,
  type Transaction,
} from "../services/expenseTransactions";
import {
  getBudgets,
  updateExpenseCategory,
  deleteExpense,
} from "../services/api";
import { suggestCategory } from "../services/autoCategory";
import { formatCurrency } from "@/lib/currency";
import { LoadingCaption } from "./LoadingCaption";
import { getCategoryColor } from "../data/categoryColors";
import { TransactionEditModal } from "./TransactionEditModal";
import { LogExpenseModal } from "./LogExpenseModal";
import { DatePicker } from "./DatePicker";

type PeriodKey = "week" | "month" | "custom";

const PAGE_SIZE = 40;

const INCOME_CATEGORIES = new Set([
  "Salary",
  "Income",
  "Refund",
  "Cashback",
  "Bonus",
  "Interest",
  "Gift",
  "Transfer",
]);

const CATEGORY_ICONS: Record<string, string> = {
  Bills: "📋",
  Entertainment: "🎬",
  Food: "🍔",
  Football: "⚽",
  "Goa Shopping": "🛍️",
  Groceries: "🛒",
  Household: "🏠",
  Personal: "👤",
  "Personal care": "🧴",
  Shopping: "🛍️",
  Subscription: "📡",
  Travel: "🚗",
  Water: "💧",
  "Work/Investment": "💼",
  Betting: "🎲",
  Rent: "🏠",
  Transport: "🚗",
  Utilities: "💡",
  Education: "📚",
  Health: "💊",
  Medical: "💊",
  Fitness: "🏋️",
  Gifts: "🎁",
  Clothing: "👕",
  Electronics: "💻",
  Pet: "🐾",
  Coffee: "☕",
  Misc: "📦",
  Miscellaneous: "📦",
};

function getCategoryIcon(category: string): string {
  return (
    CATEGORY_ICONS[category] ?? CATEGORY_ICONS[category.toLowerCase()] ?? ""
  );
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(ts: string): string {
  const m = ts.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : "";
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (iso === todayStr) return "Today";
  if (iso === yesterdayStr) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

type TimelineItem =
  | { kind: "header"; date: string; label: string; total: number }
  | { kind: "txn"; txn: Transaction };

export function TransactionsView({
  hideAmounts = false,
}: {
  hideAmounts?: boolean;
}) {
  // TESTING ONLY — set true to pin the page on the loading skeleton.
  const FORCE_LOADING_SKELETON = false;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const searchParams = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const dateParam = searchParams.get("date");
  const categoryParam = searchParams.get("category");

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingSuggestedCat, setEditingSuggestedCat] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [budgetCategories, setBudgetCategories] = useState<string[]>([]);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [actionsKey, setActionsKey] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionsKey) return;
    function handleClick(e: MouseEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(e.target as Node)
      ) {
        setActionsKey(null);
        setDeleteKey(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [actionsKey]);

  useEffect(() => {
    Promise.all([
      loadTransactions(),
      getBudgets().catch(() => [] as { category: string }[]),
    ])
      .then(([rows, budgetRows]) => {
        setTransactions(rows);
        setBudgetCategories(
          budgetRows
            .map((b) => b.category)
            .filter((c) => c !== "__income__" && c !== "__credit_card__"),
        );
        if (dateParam) {
          setPeriod("custom");
          setCustomStart(dateParam);
          setCustomEnd(dateParam);
        } else if (rows.length) {
          let latest = new Date(0);
          for (const r of rows) {
            const d = new Date(r.date);
            if (!Number.isNaN(d.getTime()) && d > latest) latest = d;
          }
          if (latest.getTime() === 0) latest = new Date();
          setCustomStart(
            toDateInput(new Date(latest.getFullYear(), latest.getMonth(), 1)),
          );
          setCustomEnd(toDateInput(latest));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateParam]);

  // Arriving from an envelope: adopt its category and match its per-month window.
  // Deliberate one-time adoption of an external (URL) value into local filter
  // state that the user can then change independently — not derivable at render time.
  useEffect(() => {
    if (!categoryParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCategory(categoryParam);
    setPeriod("month");
  }, [categoryParam]);

  const categories = useMemo(() => {
    // Budget rows repeat per month, so the same category can appear more
    // than once; dedupe so dropdown options keep unique keys.
    return [...new Set(budgetCategories)].sort();
  }, [budgetCategories]);

  const latestDate = useMemo(() => {
    if (!transactions.length) return new Date();
    let max = new Date(0);
    for (const t of transactions) {
      const d = new Date(t.date);
      if (!Number.isNaN(d.getTime()) && d > max) max = d;
    }
    return max.getTime() === 0 ? new Date() : max;
  }, [transactions]);

  const filtered = useMemo(() => {
    let rows = [...transactions];

    const end = new Date(latestDate);
    let start = new Date(0);
    if (period === "week") {
      const now = new Date(end);
      start = new Date(now);
      const diffToMonday = (start.getDay() + 6) % 7;
      start.setDate(now.getDate() - diffToMonday);
    } else if (period === "month") {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (period === "custom" && customStart && customEnd) {
      start = new Date(customStart);
      end.setTime(new Date(customEnd).getTime());
    }
    rows = rows.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    if (selectedCategory)
      rows = rows.filter((t) => t.category === selectedCategory);

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.item.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q),
      );
    }

    rows.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return b.timestamp.localeCompare(a.timestamp);
    });

    return rows;
  }, [
    transactions,
    period,
    customStart,
    customEnd,
    selectedCategory,
    search,
    latestDate,
  ]);

  useEffect(() => {
    // Reset pagination whenever any filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
  }, [period, customStart, customEnd, selectedCategory, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const g = groups.get(t.date) ?? [];
      g.push(t);
      groups.set(t.date, g);
    }
    const items: TimelineItem[] = [];
    for (const [date, txns] of groups) {
      const total = txns.reduce((s, t) => s + t.amountInr, 0);
      items.push({
        kind: "header",
        date,
        label: formatDateHeader(date),
        total,
      });
      for (const txn of txns) {
        items.push({ kind: "txn", txn });
      }
    }
    return items;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const paged = grouped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalSpend = useMemo(
    () => filtered.reduce((s, t) => s + t.amountInr, 0),
    [filtered],
  );

  // Keep the URL in step with manual filter changes so ?category= never goes stale
  function applyCategory(category: string) {
    setSelectedCategory(category);
    const next = new URLSearchParams(searchParams.toString());
    if (category) next.set("category", category);
    else next.delete("category");
    const qs = next.toString();
    router.replace(`/expense/transactions${qs ? `?${qs}` : ""}`);
  }

  function resetFilters() {
    setPeriod("week");
    applyCategory("");
    setSearch("");
    setPage(0);
  }

  async function refreshTransactions() {
    try {
      const [rows, budgetRows] = await Promise.all([
        loadTransactions(),
        getBudgets().catch(() => [] as { category: string }[]),
      ]);
      setTransactions(rows);
      setBudgetCategories(
        budgetRows
          .map((b) => b.category)
          .filter((c) => c !== "__income__" && c !== "__credit_card__"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh");
    }
  }

  async function handleDelete(t: Transaction) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExpense(t.id, t.timestamp, t.item, t.amountInr);
      setDeleteKey(null);
      setActionsKey(null);
      await refreshTransactions();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      );
    }
    setDeleting(false);
  }

  // Trigger button is commented out below (UI is disabled, not deleted) — kept
  // for whoever re-enables it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function autoTagMonth() {
    if (autoTagging) return;
    setAutoTagging(true);
    try {
      const end = new Date(latestDate);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      const monthRows = transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
      for (const t of monthRows) {
        const suggested = await suggestCategory(t.item, categories);
        if (suggested && suggested !== t.category) {
          await updateExpenseCategory(
            t.id,
            t.timestamp,
            t.item,
            t.amountInr,
            suggested,
          );
        }
      }
      await refreshTransactions();
    } catch {
      // Auto-tagging is best-effort; leave the existing categories in place
    }
    setAutoTagging(false);
  }

  if (loading || FORCE_LOADING_SKELETON) {
    return (
      <div
        className="txn-timeline erd-card"
        aria-busy="true"
        aria-live="polite"
      >
        {/* Filter bar skeleton */}
        <div className="txn-timeline-filters" aria-hidden="true">
          <div className="mc-filter-chips">
            {["This week", "This month", "Custom"].map((label) => (
              <span
                key={label}
                className="erd-skeleton"
                style={{ width: "92px", height: "32px", borderRadius: "100px" }}
              />
            ))}
          </div>
          <span
            className="erd-skeleton"
            style={{ width: "100px", height: "32px", borderRadius: "100px" }}
          />
          <span
            className="erd-skeleton"
            style={{ width: "180px", height: "32px", borderRadius: "8px" }}
          />
          <span
            className="erd-skeleton"
            style={{ width: "60px", height: "32px", borderRadius: "100px" }}
          />
          <span
            className="erd-skeleton"
            style={{ width: "90px", height: "32px", borderRadius: "100px" }}
          />
        </div>

        {/* Log expense button skeleton */}
        <span
          className="erd-skeleton"
          style={{
            width: "128px",
            height: "36px",
            borderRadius: "100px",
            marginBottom: "14px",
          }}
        />

        {/* Loading caption */}
        <LoadingCaption
          className="loading-caption-inline"
          style={{ justifyContent: "center", padding: "8px 0" }}
        />

        {/* Timeline skeleton */}
        <div className="txn-timeline-list" aria-hidden="true">
          {/* Column headers */}
          <div className="txn-timeline-col-headers">
            {["Time", "Description", "Category", "Amount"].map((label) => (
              <span
                key={label}
                className={`erd-skeleton txn-timeline-col-label ${
                  label === "Amount" ? "txn-timeline-col-label--right" : ""
                }`}
                style={{ height: "10px", borderRadius: "4px" }}
              />
            ))}
          </div>

          {/* Date header skeleton */}
          <div className="txn-timeline-header">
            <span />
            <span />
            <span
              className="erd-skeleton"
              style={{ width: "140px", height: "14px", borderRadius: "6px" }}
            />
            <span />
            <span
              className="erd-skeleton"
              style={{
                width: "80px",
                height: "14px",
                borderRadius: "6px",
                marginLeft: "auto",
              }}
            />
          </div>

          {/* Transaction row skeletons */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="txn-timeline-row">
              <span
                className="erd-skeleton"
                style={{ width: "20px", height: "20px", borderRadius: "8px" }}
              />
              <span
                className="erd-skeleton"
                style={{ width: "40px", height: "12px", borderRadius: "6px" }}
              />
              <span
                className="erd-skeleton"
                style={{
                  width: `${60 + (i % 3) * 20}%`,
                  height: "12px",
                  borderRadius: "6px",
                }}
              />
              <span
                className="erd-skeleton"
                style={{ width: "90px", height: "20px", borderRadius: "100px" }}
              />
              <span
                className="erd-skeleton"
                style={{
                  width: "70px",
                  height: "12px",
                  borderRadius: "6px",
                  marginLeft: "auto",
                }}
              />
            </div>
          ))}

          {/* Another date header */}
          <div className="txn-timeline-header" style={{ marginTop: "16px" }}>
            <span />
            <span />
            <span
              className="erd-skeleton"
              style={{ width: "120px", height: "14px", borderRadius: "6px" }}
            />
            <span />
            <span
              className="erd-skeleton"
              style={{
                width: "80px",
                height: "14px",
                borderRadius: "6px",
                marginLeft: "auto",
              }}
            />
          </div>

          {/* More transaction rows */}
          {[...Array(6)].map((_, i) => (
            <div key={`second-${i}`} className="txn-timeline-row">
              <span
                className="erd-skeleton"
                style={{ width: "20px", height: "20px", borderRadius: "8px" }}
              />
              <span
                className="erd-skeleton"
                style={{ width: "40px", height: "12px", borderRadius: "6px" }}
              />
              <span
                className="erd-skeleton"
                style={{
                  width: `${50 + (i % 4) * 15}%`,
                  height: "12px",
                  borderRadius: "6px",
                }}
              />
              <span
                className="erd-skeleton"
                style={{ width: "85px", height: "20px", borderRadius: "100px" }}
              />
              <span
                className="erd-skeleton"
                style={{
                  width: "70px",
                  height: "12px",
                  borderRadius: "6px",
                  marginLeft: "auto",
                }}
              />
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="txn-timeline-footer">
          <span
            className="erd-skeleton"
            style={{ width: "120px", height: "12px", borderRadius: "6px" }}
          />
          <span />
          <span
            className="erd-skeleton"
            style={{ width: "100px", height: "12px", borderRadius: "6px" }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="txn-timeline erd-card">
        <div className="txn-timeline-empty">
          Couldn&apos;t load transactions. {error}
        </div>
      </div>
    );
  }

  return (
    <div className="txn-timeline erd-card">
      <div className="txn-timeline-filters">
        <div
          className="mc-filter-chips"
          role="tablist"
          aria-label="Period presets"
        >
          {(["week", "month", "custom"] as PeriodKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`action-button ${period === key ? "is-active" : ""}`}
              onClick={() => setPeriod(key)}
            >
              {key === "week"
                ? "This week"
                : key === "month"
                  ? "This month"
                  : "Custom"}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="txn-timeline-dates">
            <DatePicker
              mode="range"
              value={{ start: customStart, end: customEnd }}
              onChange={({ start, end }) => {
                setCustomStart(start);
                setCustomEnd(end);
              }}
            />
          </div>
        )}

        <select
          className="txn-filter-select"
          value={selectedCategory || ""}
          onChange={(e) => applyCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="search"
          className="txn-timeline-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search"
        />

        <button
          type="button"
          className="action-button is-ghost"
          onClick={resetFilters}
        >
          Reset
        </button>

        {/* <button
          type="button"
          className="action-button"
          disabled={autoTagging}
          onClick={autoTagMonth}
          title="Auto-categorise this month's transactions"
        >
          {autoTagging ? "Tagging…" : "✨ Auto-tag"}
        </button> */}
      </div>

      {deleteError && <p className="txn-entry-error">{deleteError}</p>}

      <button
        type="button"
        className="erd-log-btn"
        onClick={() => setShowLogModal(true)}
      >
        + Log expense
      </button>

      {filtered.length === 0 ? (
        <div className="txn-timeline-empty">
          No transactions for this filter.
        </div>
      ) : (
        <motion.div
          key={page}
          className="txn-timeline-list"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
        >
          {paged.map((item, i) => {
            if (item.kind === "header") {
              return (
                <div key={`h-${item.date}`} className="txn-timeline-header">
                  <span />
                  <span className="txn-timeline-header-label">
                    {item.label}
                  </span>
                  <span />
                  <span
                    className={`txn-timeline-header-total ${hideAmounts ? "amount-hidden" : ""}`}
                  >
                    {hideAmounts ? "---" : formatCurrency(item.total)}
                  </span>
                  <span />
                </div>
              );
            }
            const t = item.txn;
            const isIncome = INCOME_CATEGORIES.has(t.category);
            const rowKey = `${t.timestamp}-${t.item}-${t.amountInr}`;
            const isEditing = editingKey === rowKey;
            return (
              <div key={`t-${t.timestamp}-${i}`} className="txn-timeline-row">
                <span className="txn-timeline-icon" title={t.category}>
                  {getCategoryIcon(t.category)}
                </span>
                <span className="txn-timeline-time">
                  {formatTime(t.timestamp)}
                </span>
                <span className="txn-timeline-item">{t.item}</span>
                <span className="txn-timeline-amount-group">
                  {isEditing ? (
                    <span className="txn-timeline-cat-col">
                      <select
                        className="txn-cat-select"
                        value={t.category}
                        disabled={updating}
                        onChange={async (e) => {
                          const newCat = e.target.value;
                          if (newCat === t.category) {
                            setEditingKey(null);
                            return;
                          }
                          setUpdating(true);
                          try {
                            await updateExpenseCategory(
                              t.id,
                              t.timestamp,
                              t.item,
                              t.amountInr,
                              newCat,
                            );
                            setEditingSuggestedCat("");
                            await refreshTransactions();
                          } catch {
                            // Keep the row as-is if the category update fails
                          }
                          setUpdating(false);
                          setEditingKey(null);
                        }}
                        onBlur={() => {
                          if (!updating) {
                            setEditingKey(null);
                            setEditingSuggestedCat("");
                          }
                        }}
                        autoFocus
                      >
                        {editingSuggestedCat &&
                          editingSuggestedCat !== t.category && (
                            <option value={editingSuggestedCat}>
                              ✨ {editingSuggestedCat}
                            </option>
                          )}
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {updating && <span className="txn-cat-saving">…</span>}
                    </span>
                  ) : (
                    <span
                      className="txn-timeline-cat-col txn-timeline-cat-pill"
                      style={
                        {
                          "--chip-accent": getCategoryColor(t.category),
                        } as React.CSSProperties
                      }
                      onClick={async () => {
                        setEditingKey(rowKey);
                        const s = await suggestCategory(t.item, categories);
                        setEditingSuggestedCat(s);
                      }}
                    >
                      {t.category}
                      <span className="cat-chevron">▾</span>
                    </span>
                  )}
                  <span
                    className={`txn-timeline-amount ${isIncome ? "is-income" : "is-expense"} ${hideAmounts ? "amount-hidden" : ""}`}
                  >
                    {hideAmounts
                      ? "---"
                      : `${isIncome ? "+" : "-"}${formatCurrency(t.amountInr)}`}
                  </span>
                </span>
                <span className="txn-actions">
                  <div className="env-action-wrap">
                    <button
                      type="button"
                      className={`env-menu-trigger txn-kebab-trigger ${actionsKey === rowKey ? "is-open" : ""}`}
                      title="Actions"
                      aria-label="Transaction actions"
                      onClick={() =>
                        setActionsKey((k) => {
                          if (k === rowKey) {
                            setDeleteKey(null);
                            return null;
                          }
                          setDeleteKey(null);
                          return rowKey;
                        })
                      }
                    >
                      ⋯
                    </button>
                    {actionsKey === rowKey && (
                      <div className="env-menu" ref={actionsMenuRef}>
                        {deleteKey === rowKey ? (
                          <div className="txn-kebab-confirm">
                            <span className="txn-kebab-confirm-label">
                              Delete this transaction?
                            </span>
                            <div className="txn-kebab-confirm-actions">
                              <button
                                type="button"
                                className="env-menu-item env-menu-item-danger"
                                disabled={deleting}
                                onClick={() => handleDelete(t)}
                              >
                                {deleting ? "Removing…" : "Remove"}
                              </button>
                              <button
                                type="button"
                                className="env-menu-item"
                                disabled={deleting}
                                onClick={() => setDeleteKey(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="env-menu-item"
                              onClick={() => {
                                setEditingTxn(t);
                                setActionsKey(null);
                              }}
                            >
                              Edit transaction
                            </button>
                            <button
                              type="button"
                              className="env-menu-item env-menu-item-danger"
                              onClick={() => setDeleteKey(rowKey)}
                            >
                              Delete transaction
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </span>
              </div>
            );
          })}
        </motion.div>
      )}

      <div className="txn-timeline-footer">
        <span>
          {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
        </span>
        {totalPages > 1 && (
          <div className="txn-timeline-pagination">
            <button
              type="button"
              className="action-button is-ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="action-button is-ghost"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
        <span>Total: {hideAmounts ? "---" : formatCurrency(totalSpend)}</span>
      </div>

      <AnimatePresence>
        {editingTxn && (
          <TransactionEditModal
            id={editingTxn.id}
            timestamp={editingTxn.timestamp}
            item={editingTxn.item}
            amountInr={editingTxn.amountInr}
            date={editingTxn.date}
            category={editingTxn.category}
            categories={categories}
            onClose={() => setEditingTxn(null)}
            onSaved={refreshTransactions}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLogModal && (
          <LogExpenseModal
            onClose={() => setShowLogModal(false)}
            onSaved={refreshTransactions}
            categories={categories}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
