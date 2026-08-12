import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  loadTransactions,
  type Transaction,
} from "../services/expenseTransactions";
import { getBudgets, updateExpenseCategory, deleteExpense } from "../services/api";
import { suggestCategory } from "../services/autoCategory";
import { TransactionEntry } from "./TransactionEntry";
import { LoadingCaption } from "./LoadingCaption";
import { Pencil, Trash2 } from "lucide-react";
import { TransactionEditModal } from "./TransactionEditModal";

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
    CATEGORY_ICONS[category] ?? CATEGORY_ICONS[category.toLowerCase()] ?? "💳"
  );
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
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

  // Arriving from an envelope: adopt its category and match its per-month window
  useEffect(() => {
    if (!categoryParam) return;
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
      await deleteExpense(t.timestamp, t.item, t.amountInr);
      setDeleteKey(null);
      await refreshTransactions();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      );
    }
    setDeleting(false);
  }

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

  if (loading) {
    return (
      <div className="txn-timeline erd-card">
        {/* Filter bar skeleton */}
        <div className="txn-timeline-filters" aria-hidden="true">
          <div className="mc-filter-chips" style={{ opacity: 0.4 }}>
            {["This week", "This month", "Custom"].map((label) => (
              <span
                key={label}
                className="action-button"
                style={{ pointerEvents: "none" }}
              >
                {label}
              </span>
            ))}
          </div>
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "100px", height: "32px", borderRadius: "6px" }}
          />
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "180px", height: "32px", borderRadius: "6px" }}
          />
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "60px", height: "32px", borderRadius: "6px" }}
          />
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "90px", height: "32px", borderRadius: "6px" }}
          />
        </div>

        {/* Transaction entry skeleton */}
        <div style={{ padding: "12px 0" }}>
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "100%", height: "32px", borderRadius: "8px" }}
          />
        </div>

        {/* Loading caption */}
        <LoadingCaption
          className="loading-caption-inline"
          style={{ justifyContent: "center", padding: "8px 0" }}
        />

        {/* Timeline skeleton */}
        <div className="txn-timeline-list" aria-hidden="true">
          {/* Column headers */}
          <div className="txn-timeline-col-headers" style={{ opacity: 0.4 }}>
            <span />
            <span className="txn-timeline-col-label">Time</span>
            <span className="txn-timeline-col-label">Description</span>
            <span className="txn-timeline-col-label">Category</span>
            <span className="txn-timeline-col-label txn-timeline-col-label--right">
              Amount
            </span>
          </div>

          {/* Date header skeleton */}
          <div className="txn-timeline-header">
            <span />
            <span />
            <span
              className="expense-skeleton expense-skeleton-line"
              style={{ width: "140px", height: "14px" }}
            />
            <span />
            <span
              className="expense-skeleton expense-skeleton-line"
              style={{ width: "80px", height: "14px", marginLeft: "auto" }}
            />
          </div>

          {/* Transaction row skeletons */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="txn-timeline-row" style={{ opacity: 0.6 }}>
              <span
                className="expense-skeleton"
                style={{ width: "20px", height: "20px", borderRadius: "4px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "40px", height: "12px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: `${60 + (i % 3) * 20}%`, height: "12px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "90px", height: "20px", borderRadius: "10px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "70px", height: "12px", marginLeft: "auto" }}
              />
            </div>
          ))}

          {/* Another date header */}
          <div className="txn-timeline-header" style={{ marginTop: "16px" }}>
            <span />
            <span />
            <span
              className="expense-skeleton expense-skeleton-line"
              style={{ width: "120px", height: "14px" }}
            />
            <span />
            <span
              className="expense-skeleton expense-skeleton-line"
              style={{ width: "80px", height: "14px", marginLeft: "auto" }}
            />
          </div>

          {/* More transaction rows */}
          {[...Array(6)].map((_, i) => (
            <div
              key={`second-${i}`}
              className="txn-timeline-row"
              style={{ opacity: 0.6 }}
            >
              <span
                className="expense-skeleton"
                style={{ width: "20px", height: "20px", borderRadius: "4px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "40px", height: "12px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: `${50 + (i % 4) * 15}%`, height: "12px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "85px", height: "20px", borderRadius: "10px" }}
              />
              <span
                className="expense-skeleton expense-skeleton-line"
                style={{ width: "70px", height: "12px", marginLeft: "auto" }}
              />
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="txn-timeline-footer" style={{ opacity: 0.4 }}>
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "120px", height: "12px" }}
          />
          <span />
          <span
            className="expense-skeleton expense-skeleton-line"
            style={{ width: "100px", height: "12px" }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="txn-timeline erd-card">
        <div className="txn-timeline-empty">
          Couldn't load transactions. {error}
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
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              aria-label="Start date"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              aria-label="End date"
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

        <button
          type="button"
          className="action-button"
          disabled={autoTagging}
          onClick={autoTagMonth}
          title="Auto-categorise this month's transactions"
        >
          {autoTagging ? "Tagging…" : "✨ Auto-tag"}
        </button>
      </div>

      {deleteError && <p className="txn-entry-error">{deleteError}</p>}

      <TransactionEntry categories={categories} onSaved={refreshTransactions} />

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
          <div className="txn-timeline-col-headers">
            <span />
            <span className="txn-timeline-col-label">Time</span>
            <span className="txn-timeline-col-label">Description</span>
            <span className="txn-timeline-col-label">Category</span>
            <span className="txn-timeline-col-label txn-timeline-col-label--right">
              Amount
            </span>
            <span />
          </div>
          {paged.map((item, i) => {
            if (item.kind === "header") {
              return (
                <div key={`h-${item.date}`} className="txn-timeline-header">
                  <span />
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
                <span className="txn-actions">
                  {deleteKey === rowKey ? (
                    <span className="txn-actions-confirm">
                      <button
                        type="button"
                        className="txn-action-btn is-danger"
                        disabled={deleting}
                        onClick={() => handleDelete(t)}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="txn-action-btn"
                        disabled={deleting}
                        onClick={() => setDeleteKey(null)}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="txn-action-btn"
                        title="Edit transaction"
                        aria-label="Edit transaction"
                        onClick={() => setEditingTxn(t)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="txn-action-btn"
                        title="Delete transaction"
                        aria-label="Delete transaction"
                        onClick={() => setDeleteKey(rowKey)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
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
    </div>
  );
}
