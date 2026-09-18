import { useCurrency } from "@/src/context/CurrencyContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toTransactions, type Transaction } from "../lib/expenseTransactions";
import { useBudgets } from "../hooks/useBudgets";
import { useExpensesPage, useDeleteExpense } from "../hooks/useExpenses";
import { EMPTY } from "../lib/constants";
import { orderWithRecents } from "../lib/recentCategories";
import { useRecentCategories } from "../hooks/useRecentCategories";

import { LoadingCaption } from "./LoadingCaption";
import { getCategoryColor } from "../data/categoryColors";
import { TransactionEditModal } from "./TransactionEditModal";
import { LogExpenseModal } from "./LogExpenseModal";
import { DatePicker } from "./DatePicker";
import { categoryEmoji, splitEmoji } from "../lib/emoji";

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

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const month = d.toLocaleDateString("en-IN", { month: "short" });
  const year = String(d.getFullYear()).slice(2);
  return `${day} ${month} '${year}`;
}

// Mirrors Mobile's activity.tsx avatarColorFor — reuses this app's existing
// per-category color instead of inventing a second palette.
function avatarTint(category: string): string {
  return `color-mix(in oklab, ${getCategoryColor(category)} 30%, transparent)`;
}

export function TransactionsView({
  hideAmounts = false,
}: {
  hideAmounts?: boolean;
}) {
  const { formatCurrency } = useCurrency();

  const budgetsQuery = useBudgets();
  const deleteExpenseM = useDeleteExpense();

  // Period and the custom range start as derived values and become state only
  // once the user touches them. Seeding them from an effect instead made them
  // snap back to the newest row on every refetch, and is what
  // react-hooks/set-state-in-effect exists to catch.
  const [periodOverride, setPeriod] = useState<PeriodKey | null>(null);
  const [customStartOverride, setCustomStart] = useState<string | null>(null);
  const [customEndOverride, setCustomEnd] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // A cheap 1-row fetch to anchor "this week"/"this month" off the newest
  // logged transaction, the same way the old full-fetch version did — not
  // real-world "today", which is deliberate (see latestDate below).
  const anchorQuery = useExpensesPage({ page: 1, limit: 1 });
  const anchorDate = useMemo(() => {
    const iso = anchorQuery.data?.rows[0]?.date;
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [anchorQuery.data]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const dateParam = searchParams.get("date");
  const categoryParam = searchParams.get("category");

  const budgetCategories = useMemo(
    () =>
      (budgetsQuery.data ?? EMPTY)
        .map((b) => b.category)
        .filter((c) => c !== "__income__" && c !== "__credit_card__"),
    [budgetsQuery.data],
  );
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

  /**
   * The custom range's default: the day named in ?date=, else the month
   * containing the newest transaction. Only a default — the moment the user
   * picks a range, the override below wins.
   */
  const seededRange = useMemo(() => {
    if (dateParam) return { start: dateParam, end: dateParam };
    const latest = anchorDate ?? new Date();
    return {
      start: toDateInput(new Date(latest.getFullYear(), latest.getMonth(), 1)),
      end: toDateInput(latest),
    };
  }, [dateParam, anchorDate]);

  // Arriving with ?date= means the user asked for one specific day.
  const period: PeriodKey = periodOverride ?? (dateParam ? "custom" : "week");
  const customStart = customStartOverride ?? seededRange.start;
  const customEnd = customEndOverride ?? seededRange.end;

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
  const { recents } = useRecentCategories();
  const orderedCategories = useMemo(
    () => orderWithRecents(categories, recents),
    [categories, recents],
  );

  const latestDate = useMemo(() => anchorDate ?? new Date(), [anchorDate]);

  // The date window sent to the server — same week/month/custom math the old
  // client-side filter used, now producing a `from`/`to` pair instead of
  // filtering an already-fetched array.
  const { from, to } = useMemo(() => {
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
    return { from: toDateInput(start), to: toDateInput(end) };
  }, [period, customStart, customEnd, latestDate]);

  const expensesQuery = useExpensesPage({
    page,
    limit: PAGE_SIZE,
    category: selectedCategory || undefined,
    from,
    to,
    q: search || undefined,
  });
  const loading = anchorQuery.isLoading || expensesQuery.isLoading;
  const error = expensesQuery.error ? "Couldn't load your transactions." : null;

  const pageTransactions = useMemo(
    () => toTransactions(expensesQuery.data?.rows ?? EMPTY),
    [expensesQuery.data],
  );

  useEffect(() => {
    // Reset pagination whenever any filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [period, customStart, customEnd, selectedCategory, search]);

  const totalCount = expensesQuery.data?.total ?? 0;
  const totalPages = expensesQuery.data?.pageCount ?? 1;
  const totalSpend = expensesQuery.data?.totalAmount ?? 0;

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
    setPage(1);
  }

  // The mutation hooks invalidate the expense and budget queries themselves,
  // so there is nothing left for callers to refresh by hand.
  function refreshTransactions() {}

  async function handleDelete(t: Transaction) {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExpenseM.mutateAsync({
        id: t.id,
        version: t.version,
        timestamp: t.timestamp,
        item: t.item,
        amountInr: t.amountInr,
      });
      setDeleteKey(null);
      setActionsKey(null);
      await refreshTransactions();
    } catch (err) {
      // A conflict requires a new confirmation after reviewing the refreshed row.
      setDeleteKey(null);
      setActionsKey(null);
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete transaction",
      );
    }
    setDeleting(false);
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
          {orderedCategories.map((c) => (
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
      </div>

      {deleteError && <p className="txn-entry-error">{deleteError}</p>}

      <button
        type="button"
        className="erd-log-btn"
        onClick={() => setShowLogModal(true)}
      >
        + Log expense
      </button>

      {loading ? (
        <div className="txn-timeline-loading">
          <LoadingCaption placement="page" />
        </div>
      ) : error ? (
        <div className="txn-timeline-empty">
          Couldn&apos;t load transactions. {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="account-empty txn-timeline-empty">
          <span aria-hidden="true">🧾</span>
          {search || selectedCategory ? (
            <>
              <div className="account-empty-title">Nothing matches</div>
              <p className="account-row-meta">No transactions for this filter.</p>
              <button type="button" className="action-button is-active" onClick={resetFilters}>
                Reset filters
              </button>
            </>
          ) : (
            <>
              <div className="account-empty-title">No transactions yet</div>
              <p className="account-row-meta">Log an expense and it shows up here.</p>
              <button type="button" className="action-button is-active" onClick={() => setShowLogModal(true)}>
                Log your first expense
              </button>
            </>
          )}
        </div>
      ) : (
        <motion.div
          key={page}
          className="txn-timeline-list"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
        >
          {pageTransactions.map((t, i) => {
            const isIncome = INCOME_CATEGORIES.has(t.category);
            const rowKey = `${t.timestamp}-${t.item}-${t.amountInr}`;
            const categoryName = splitEmoji(t.category).text;
            return (
              <div key={`t-${t.timestamp}-${i}`} className="txn-timeline-row">
                <span
                  className="txn-timeline-icon"
                  title={categoryName}
                  style={{ background: avatarTint(categoryName) }}
                >
                  {categoryEmoji(t.category)}
                </span>
                <span className="txn-timeline-body">
                  <span className="txn-timeline-item">{t.item}</span>
                  <span className="txn-timeline-meta">
                    {formatShortDate(t.date)} · {categoryName}
                  </span>
                </span>
                <span
                  className={`txn-timeline-amount ${isIncome ? "is-income" : "is-expense"} ${hideAmounts ? "amount-hidden" : ""}`}
                >
                  {hideAmounts
                    ? "---"
                    : `${isIncome ? "+" : "-"}${formatCurrency(t.amountInr)}`}
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

      {!loading && !error && (
        <div className="txn-timeline-footer">
          <span>
            {totalCount} transaction{totalCount !== 1 ? "s" : ""}
          </span>
          {totalPages > 1 && (
            <div className="txn-timeline-pagination">
              <button
                type="button"
                className="action-button is-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="action-button is-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
          <span>Total: {hideAmounts ? "---" : formatCurrency(totalSpend)}</span>
        </div>
      )}

      <AnimatePresence>
        {editingTxn && (
          <TransactionEditModal
            id={editingTxn.id}
            version={editingTxn.version}
            timestamp={editingTxn.timestamp}
            item={editingTxn.item}
            amountInr={editingTxn.amountInr}
            date={editingTxn.date}
            category={editingTxn.category}
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
