import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { useAppearance } from "../../components/AppearanceProvider";
import { formatCurrency } from "@/lib/currency";
import { FluidDemo } from "../components/FluidDemo";
import { ReadyToAssignBanner } from "../components/ReadyToAssignBanner";
import { EnvelopeGrid } from "../components/EnvelopeGrid";
import { MoveMoneyModal } from "../components/MoveMoneyModal";
import { ExpenseSidebar } from "../components/ExpenseSidebar";
import { CategoryManager } from "../components/CategoryManager";
import { SubscriptionModal } from "../components/SubscriptionModal";
import { Scrim, Sheet } from "../components/MotionSheet";
import { ExpensePageSkeleton } from "../components/ExpensePageSkeletons";
import { getEffectiveDueDate, daysUntil, renewalDays } from "@/lib/subscriptions";
import {
  toExpensePanelData,
  type ExpensePanelData,
} from "../services/expensePanelAdapter";
import { buildExpensePanel } from "../lib/expensePanel";
import { EMPTY } from "../lib/constants";
import { useBudgets, useAddBudget, useUpdateBudget, useTransferBudget } from "../hooks/useBudgets";
import { useExpenses, useAddExpense } from "../hooks/useExpenses";
import { useCategories } from "../hooks/useCategories";
import { useGroups } from "../hooks/useGroups";
import { useHideAmounts } from "../hooks/useHideAmounts";
import {
  useSubscriptions,
  useCancelSubscription,
  useReactivateSubscription,
} from "../hooks/useSubscriptions";
import { MonthRolloverBanner } from "../components/MonthRolloverBanner";
import { LogExpenseModal } from "../components/LogExpenseModal";
import { SuccessButton, useButtonPhase } from "../components/SuccessButton";
import type { BudgetRow, EnvelopeState } from "../types/expense";

type ActiveSubscription = ExpensePanelData["subscriptions"]["active"][number];

// type ExpenseTab = 'overview' | 'transactions' | 'insights'

export function ExpensePage() {
  // TESTING ONLY — set true to pin the page on the loading skeleton.
  const FORCE_LOADING_SKELETON = false;
  // One query per resource, as Mobile has, with the dashboard's derived panel
  // recomputed from them. The old single SWR fetcher both fetched and derived;
  // buildExpensePanel is the derivation half, now pure.
  const budgetsQuery = useBudgets();
  const expensesQuery = useExpenses();
  const categoriesQuery = useCategories();
  const groupsQuery = useGroups();
  const subscriptionsQuery = useSubscriptions();

  const addBudgetM = useAddBudget();
  const updateBudgetM = useUpdateBudget();
  const transferBudgetM = useTransferBudget();
  const addExpenseM = useAddExpense();
  const cancelSubscriptionM = useCancelSubscription();
  const reactivateSubscriptionM = useReactivateSubscription();

  const budgetRows = budgetsQuery.data ?? EMPTY;
  const expenseRows = expensesQuery.data ?? EMPTY;
  const categoryRows = categoriesQuery.data ?? EMPTY;
  const groupNames = groupsQuery.data ?? EMPTY;
  const subscriptionRows = subscriptionsQuery.data ?? EMPTY;

  const anyLoading =
    budgetsQuery.isLoading ||
    expensesQuery.isLoading ||
    categoriesQuery.isLoading ||
    groupsQuery.isLoading ||
    subscriptionsQuery.isLoading;

  const panel = useMemo<ExpensePanelData | null>(
    () =>
      anyLoading
        ? null
        : toExpensePanelData(
            buildExpensePanel({
              budgets: budgetRows,
              expenses: expenseRows,
              subscriptions: subscriptionRows,
              categories: categoryRows,
              groups: groupNames,
            }),
          ),
    [anyLoading, budgetRows, expenseRows, subscriptionRows, categoryRows, groupNames],
  );
  // Read-only here: the toggle lives on /account, next to the theme control.
  const [hideAmounts] = useHideAmounts();
  const [envelopeState, setEnvelopeState] = useState<EnvelopeState | null>(
    null,
  );
  const [moveMoneyTarget, setMoveMoneyTarget] = useState<string | null>(null);
  const [envelopeSearch, setEnvelopeSearch] = useState("");
  const [envelopeSort, setEnvelopeSort] = useState<
    "custom" | "overspent-first" | "alphabetical" | "by-assigned"
  >("custom");
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showBulkReturnConfirm, setShowBulkReturnConfirm] = useState(false);
  const [showRolloverBanner, setShowRolloverBanner] = useState(false);
  const [rolloverData, setRolloverData] = useState<{
    lastMonth: string;
    lastIncome: number;
    lastAssignments: Array<{ category: string; assigned: number }>;
  } | null>(null);
  const [cancellingSub, setCancellingSub] = useState<string | null>(null);
  const [reactivatingSub, setReactivatingSub] = useState<string | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showFluidDemo, setShowFluidDemo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(t);
  }, [actionError]);
  const [payCreditCardAmount, setPayCreditCardAmount] = useState<number | null>(
    null,
  );
  const payPhase = useButtonPhase();
  const bulkReturnPhase = useButtonPhase();
  const [editSub, setEditSub] = useState<{
    service: string;
    amount_inr: string;
    billing_cycle: string;
    next_due_date: string;
    notes: string;
    category: string;
  } | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const { theme, setTheme } = useAppearance();

  // Restore the "hide amounts" preference after hydration so the server and
  // client render the same initial output (avoids a hydration mismatch).
  // The mutation hooks invalidate the queries they touch, so a refresh is no
  // longer something this page asks for — only the row-level busy flags are
  // left to clear.
  function refreshPanel() {
    setCancellingSub(null);
    setReactivatingSub(null);
  }

  // Keep envelopeState in sync with the panel contract, while still allowing
  // optimistic local updates (handleIncomeChange, handleAssignFromRTA, etc.)
  // to apply in between contract refreshes.
  useEffect(() => {
    if (panel) setEnvelopeState(panel.envelopeState);
  }, [panel]);

  async function handleIncomeChange(newIncome: number) {
    const month = envelopeState?.month;
    const income = Math.round(newIncome) || 0;
    if (month) {
      // PUT /api/budgets already upserts server-side — no need for a
      // fallback POST here. A real failure (network, read-only demo, 500)
      // is surfaced instead of being misread as "row doesn't exist" and
      // retried against a different endpoint.
      try {
        await updateBudgetM.mutateAsync({ month, category: "__income__", updates: { assigned: String(income) } });
      } catch {
        setActionError("Couldn't save income — check your connection.");
        return;
      }
    }
    localStorage.removeItem("expense-income-override");
    setEnvelopeState((prev) => {
      if (!prev) return prev;
      const totalAssigned = prev.envelopes.reduce((s, e) => s + e.assigned, 0);
      const rta = Math.round(income - totalAssigned) || 0;
      return { ...prev, income, readyToAssign: rta, isOverAssigned: rta < 0 };
    });
  }

  function handleAssignFromRTA(category: string, amount: number) {
    setEnvelopeState((prev) => {
      if (!prev) return prev;
      const current = prev.envelopes.find((e) => e.category === category);
      const prevAssigned = current?.assigned ?? 0;
      const newAssigned = prevAssigned + amount;

      const month = prev.month;
      if (current) {
        updateBudgetM.mutateAsync({ month, category, updates: { assigned: String(newAssigned) } }).catch(
          () => {},
        );
      } else {
        addBudgetM.mutateAsync({ month, category, assigned: String(amount) }).catch(
          () => {},
        );
      }

      const updated = prev.envelopes.map((e) => {
        if (e.category === category) {
          return {
            ...e,
            assigned: newAssigned,
            available: e.available + amount,
          };
        }
        return e;
      });
      const totalAssigned = updated.reduce((s, e) => s + e.assigned, 0);
      const rta = Math.round(prev.income - totalAssigned) || 0;
      return {
        ...prev,
        envelopes: updated,
        totalAssigned,
        readyToAssign: rta,
        isOverAssigned: rta < 0,
      };
    });
  }

  function handleSetAssigned(category: string, amount: number) {
    setEnvelopeState((prev) => {
      if (!prev) return prev;
      const assigned = Math.round(amount) || 0;
      const updated = prev.envelopes.map((e) => {
        if (e.category !== category) return e;
        const available = assigned + e.rolledOver - e.spent;
        return {
          ...e,
          assigned,
          available,
          isOverspent: available < 0,
          spentPct:
            assigned > 0
              ? Math.min(100, (e.spent / assigned) * 100)
              : e.spent > 0
                ? 100
                : 0,
        };
      });
      const totalAssigned = updated.reduce((s, e) => s + e.assigned, 0);
      const rta = Math.round(prev.income - totalAssigned) || 0;
      updateBudgetM.mutateAsync({ month: prev.month, category, updates: { assigned: String(assigned) } }).catch(
        () => {},
      );
      return {
        ...prev,
        envelopes: updated,
        totalAssigned,
        readyToAssign: rta,
        isOverAssigned: rta < 0,
      };
    });
  }

  function handleBulkReturnToRTA() {
    if (!envelopeState) return;
    const positive = envelopeState.envelopes.filter((e) => e.available > 0);
    if (positive.length === 0) return;

    setEnvelopeState((prev) => {
      if (!prev) return prev;
      const month = prev.month;
      const updated = prev.envelopes.map((e) => {
        if (e.available > 0) {
          updateBudgetM
            .mutateAsync({
              month,
              category: e.category,
              updates: { assigned: String(e.assigned - e.available) },
            })
            .catch(() => {});
          return { ...e, assigned: e.assigned - e.available, available: 0 };
        }
        return e;
      });
      const totalAssigned = updated.reduce((s, e) => s + e.assigned, 0);
      const rta = prev.income - totalAssigned;
      const log = {
        type: "bulk-return-to-rta",
        month,
        timestamp: new Date().toISOString(),
        categories: positive.map((e) => ({
          category: e.category,
          amount: e.available,
        })),
        totalReturned: positive.reduce((s, e) => s + e.available, 0),
      };
      try {
        const logs = JSON.parse(
          localStorage.getItem("budget-transfer-log") || "[]",
        );
        logs.push(log);
        localStorage.setItem("budget-transfer-log", JSON.stringify(logs));
      } catch {
        // Transfer log is diagnostic only — a write failure shouldn't block the return
      }
      return {
        ...prev,
        envelopes: updated,
        totalAssigned,
        readyToAssign: rta,
        isOverAssigned: rta < 0,
      };
    });
    bulkReturnPhase.succeed(() => setShowBulkReturnConfirm(false));
  }

  async function handlePayCreditCard() {
    const ccEnv = envelopeState?.envelopes.find((e) => e.isCreditCardPayment);
    const amount = ccEnv?.available;
    if (!amount || amount <= 0) return;
    setPayCreditCardAmount(amount);
  }

  async function confirmPayCreditCard(amount: number) {
    // Deliberately not caught here — the caller drives the button's
    // saving/success/fail phase and must know whether this actually worked
    // before showing a success checkmark.
    await addExpenseM.mutateAsync({
      item: "Credit Card Payment",
      amount_inr: String(amount),
      category: "__credit_card__",
      payment_method: "bank",
    });
    await refreshPanel();
  }

  useEffect(() => {
    if (!panel) return;
    const override = localStorage.getItem("expense-income-override");
    if (override === null) return;
    const value = Math.round(Number(override)) || 0;
    const month = panel.month;
    (async () => {
      // PUT /api/budgets already upserts server-side — see handleIncomeChange
      // for why the old catch-as-control-flow fallback to addBudget was
      // redundant (and, on a real failure, misleading).
      try {
        await updateBudgetM.mutateAsync({ month, category: "__income__", updates: { assigned: String(value) } });
        localStorage.removeItem("expense-income-override");
      } catch {
        setActionError("Couldn't save income — check your connection.");
      }
    })();
    // Deliberately keyed on `panel` alone: this drains a one-shot localStorage
    // override once the month is known. The mutation object is re-created each
    // render but stays bound to the same query client, so including it would
    // only re-run this for no gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  function prevMonth(key: string): string {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  useEffect(() => {
    if (!panel) return;
    const storedMonth = localStorage.getItem("budget-active-month");
    if (storedMonth === panel.month) return;
    const p = panel;

    async function checkRollover() {
      // Already loaded by useBudgets — this used to be a second fetch.
      const budgets: BudgetRow[] = budgetRows.map((r) => ({
        month: r.month,
        category: r.category,
        assigned: Number(r.assigned),
        rolledOver: Number(r.rolled_over),
      }));

      const hasCurrentMonthData = budgets.some(
        (r) =>
          r.month === p.month &&
          (r.category === "__income__" || r.assigned > 0),
      );
      if (hasCurrentMonthData) {
        localStorage.setItem("budget-active-month", p.month);
        return;
      }

      const lastMonthKey = prevMonth(p.month);
      const lastIncome =
        budgets.find(
          (r) => r.month === lastMonthKey && r.category === "__income__",
        )?.assigned ?? 0;
      const lastAssignments = budgets
        .filter((r) => r.month === lastMonthKey && r.category !== "__income__")
        .map((r) => ({ category: r.category, assigned: r.assigned }));
      setRolloverData({ lastMonth: lastMonthKey, lastIncome, lastAssignments });
      setShowRolloverBanner(true);
    }
    checkRollover();
    // Deliberately keyed on `panel` alone: this asks once per month whether to
    // offer a rollover. `panel` is null until every query has loaded, so
    // budgetRows is already populated whenever this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  async function handleRolloverConfirm(income: number, copyAssigned: boolean) {
    const p = panel;
    if (!p) return;
    const month = p.month;
    const lastMonthKey = prevMonth(month);

    const budgets: BudgetRow[] = budgetRows.map((r) => ({
      month: r.month,
      category: r.category,
      assigned: Number(r.assigned),
      rolledOver: Number(r.rolled_over),
    }));
    const categoryNames = categoryRows.map((c) => c.name);

    const lastMonthRows = budgets.filter(
      (b) => b.month === lastMonthKey && b.category !== "__income__",
    );
    let totalOverspent = 0;
    for (const row of lastMonthRows) {
      const lastExpenses = p.expenseRows.filter(
        (e) => e.date.startsWith(lastMonthKey) && e.category === row.category,
      );
      const spent = lastExpenses.reduce((s, e) => s + e.amountInr, 0);
      const available = row.assigned + row.rolledOver - spent;
      if (available < 0) totalOverspent += Math.abs(available);
    }

    const effectiveIncome = Math.max(0, income - totalOverspent);
    await addBudgetM
      .mutateAsync({ month, category: "__income__", assigned: String(effectiveIncome) })
      .catch(() => {});

    const allCategoryNames = [
      ...new Set([...categoryNames, ...lastMonthRows.map((r) => r.category)]),
    ];
    for (const cat of allCategoryNames) {
      const lastRow = lastMonthRows.find((r) => r.category === cat);
      const assigned = copyAssigned && lastRow ? lastRow.assigned : 0;
      await addBudgetM
        .mutateAsync({ month, category: cat, assigned: String(assigned) })
        .catch(() => {});
    }

    localStorage.setItem("budget-active-month", month);
    await refreshPanel();
  }

  function handleRolloverDismiss() {
    setShowRolloverBanner(false);
    setRolloverData(null);
  }

  if (!panel || FORCE_LOADING_SKELETON) {
    return <ExpensePageSkeleton />;
  }

  function handleSidebarMoveMoney() {
    const firstOverspent = envelopeState?.envelopes.find((e) => e.isOverspent);
    if (firstOverspent) setMoveMoneyTarget(firstOverspent.category);
  }

  function handleShowCategories() {
    const el = document.querySelector(".erd-envelopes-panel");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const overspentCount =
    envelopeState?.envelopes.filter((e) => e.isOverspent).length ?? 0;

  return (
    <section className="expense-redesign">
      {actionError && (
        <div className="erd-action-error" role="alert">
          {actionError}
        </div>
      )}
      <button
        type="button"
        className="erd-theme-toggle"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <header className="erd-mobile-header">
        <div className="erd-mobile-greet">
          Hey Sukrit <span>👋</span>
        </div>
        <div className="erd-mobile-sub">
          <span>
            {panel.month}
            {envelopeState
              ? ` · Income ${formatCurrency(envelopeState.income)}`
              : ""}
          </span>
          <span className="erd-mobile-rta">
            RTA{" "}
            {envelopeState ? formatCurrency(envelopeState.readyToAssign) : "…"}
          </span>
        </div>
      </header>

      {envelopeState && (
        <div className="erd-mobile-stats">
          <div className="erd-mstat erd-mstat-rta">
            <span>Ready to assign</span>
            <strong>{formatCurrency(envelopeState.readyToAssign)}</strong>
          </div>
          <div className="erd-mstat">
            <span>Income</span>
            <strong>{formatCurrency(envelopeState.income)}</strong>
          </div>
          <div className={`erd-mstat ${overspentCount > 0 ? "is-neg" : ""}`}>
            <span>Overspent</span>
            <strong>{overspentCount}</strong>
          </div>
        </div>
      )}

      <div className="erd-main">
        <ExpenseSidebar
          onMoveMoney={handleSidebarMoveMoney}
          onShowCategories={handleShowCategories}
          onBulkReturn={() => setShowBulkReturnConfirm(true)}
          month={panel.month}
          income={envelopeState?.income}
          totalSpent={envelopeState?.totalSpent}
        />
        <div className="erd-content">
        <div className="erd-left-col">
          <div className="erd-dashboard-link-row">
            <Link href="/insights" className="erd-log-btn">
              Open spending insights
            </Link>
            <button type="button" className="erd-log-btn" onClick={() => setShowLogModal(true)}>
              + Log expense
            </button>
          </div>

            <article className="erd-card erd-envelopes-panel">
              <div className="erd-panel-head">
                <div className="erd-panel-title">
                  <div>
                    <h3>Envelopes</h3>
                    <p className="erd-panel-head-sub">
                      Assigned · Spent · Available
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="erd-manage-btn"
                  onClick={() => setShowCategoryManager(true)}
                >
                  Manage
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="search"
                  className="erd-search-input"
                  placeholder="Search categories or groups…"
                  value={envelopeSearch}
                  onChange={(e) => setEnvelopeSearch(e.target.value)}
                  style={{ width: "220px", marginTop: 0 }}
                />
                <select
                  value={envelopeSort}
                  onChange={(e) =>
                    setEnvelopeSort(e.target.value as typeof envelopeSort)
                  }
                  className="erd-search-input"
                  style={{ width: "auto", marginTop: 0 }}
                >
                  <option value="custom">Custom order</option>
                  <option value="overspent-first">Overspent first</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="by-assigned">By assigned amount</option>
                </select>
              </div>
              {envelopeState && (
                <div className="erd-table-wrap">
                  <EnvelopeGrid
                    envelopes={envelopeState.envelopes}
                    groups={envelopeState.groups}
                    hideAmounts={hideAmounts}
                    readyToAssign={envelopeState.readyToAssign}
                    searchQuery={envelopeSearch}
                    sortKey={envelopeSort}
                    onMoveMoney={(cat) => setMoveMoneyTarget(cat)}
                    onAssignFromRTA={handleAssignFromRTA}
                    onSetAssigned={handleSetAssigned}
                    onPayCreditCard={handlePayCreditCard}
                  />
                </div>
              )}
            </article>

              <article className="erd-card erd-subs-panel">
                <div className="erd-panel-head">
                  <div className="erd-panel-title">
                    <div>
                      <h3>Subscriptions</h3>
                      <p className="erd-panel-head-sub">
                        Recurring monthly burn
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="erd-manage-btn"
                    onClick={() => setShowSubModal(true)}
                    title="Add subscription"
                  >
                    + Add
                  </button>
                </div>
                {(() => {
                  function monthlyEq(sub: ActiveSubscription): number {
                    if (/yearly|annual/i.test(sub.billingCycle))
                      return sub.amountInr / 12;
                    if (/quarterly/i.test(sub.billingCycle))
                      return sub.amountInr / 3;
                    if (/weekly/i.test(sub.billingCycle))
                      return sub.amountInr * 4.33;
                    return sub.amountInr;
                  }

                  function cleanCycle(cycle: string): string {
                    if (/one-time/i.test(cycle)) return "one-time";
                    if (/monthly/i.test(cycle)) return "monthly";
                    if (/yearly|annual/i.test(cycle)) return "yearly";
                    if (/quarterly/i.test(cycle)) return "quarterly";
                    if (/weekly/i.test(cycle)) return "weekly";
                    return cycle;
                  }

                  function renewalText(sub: ActiveSubscription): string {
                    return daysUntil(getEffectiveDueDate(sub));
                  }

                  function urgencyClass(days: number): string {
                    if (days === 0) return "urgency-today";
                    if (days <= 3) return "urgency-soon";
                    if (days <= 7) return "urgency-week";
                    return "urgency-later";
                  }

                  const sorted = [...panel.subscriptions.active].sort(
                    (a, b) => monthlyEq(b) - monthlyEq(a),
                  );
                  const totalMonthly = Math.round(
                    sorted.reduce((s, sub) => s + monthlyEq(sub), 0),
                  );
                  const totalYearly = Math.round(totalMonthly * 12);

                  return (
                    <>
                      <div className="erd-subs-totals">
                        <span>
                          <strong>
                            {hideAmounts
                              ? "---"
                              : `~${formatCurrency(totalMonthly)}`}
                          </strong>{" "}
                          /mo
                        </span>
                        <span>
                          <strong>{panel.subscriptions.active.length}</strong>{" "}
                          active
                        </span>
                        <span>
                          <strong>
                            {hideAmounts
                              ? "---"
                              : `~${formatCurrency(totalYearly)}`}
                          </strong>{" "}
                          /yr
                        </span>
                      </div>

                      <div className="sub-breakdown">
                        <span className="sub-breakdown-label">
                          % of monthly spend
                        </span>
                        {sorted.map((sub) => {
                          const meq = monthlyEq(sub);
                          const pct =
                            totalMonthly > 0 ? (meq / totalMonthly) * 100 : 0;
                          return (
                            <div key={sub.service} className="sub-bar-row">
                              <span className="sub-bar-label">
                                {sub.service}
                              </span>
                              <div className="sub-bar-track">
                                <div
                                  className="sub-bar-fill"
                                  style={{ width: `${Math.max(3, pct)}%` }}
                                />
                              </div>
                              <span className="sub-bar-value">
                                {Math.round(pct)}% ·{" "}
                                {formatCurrency(Math.round(meq))}/mo
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="subscription-lists">
                        <details className="subscription-accordion" open>
                          <summary>
                            <h4>
                              Active ({panel.subscriptions.active.length})
                            </h4>
                            <span className="chevron" aria-hidden="true">
                              ▾
                            </span>
                          </summary>
                          <ul className="sub-list">
                            {sorted.map((sub) => {
                              const renew = renewalText(sub);
                              const rDays = renewalDays(sub);
                              const isYearly = /yearly|annual/i.test(
                                sub.billingCycle,
                              );
                              return (
                                <li key={sub.service} className="sub-row">
                                  <div className="sub-row-info">
                                    <strong>{sub.service}</strong>
                                    <span className="sub-meta">
                                      {cleanCycle(sub.billingCycle)}
                                      {renew ? (
                                        <>
                                          {" · "}
                                          {rDays < Infinity && (
                                            <span
                                              className={`urgency-dot ${urgencyClass(rDays)}`}
                                            />
                                          )}
                                          {renew}
                                        </>
                                      ) : null}
                                      <>
                                        {" · "}
                                        {hideAmounts
                                          ? "---"
                                          : formatCurrency(sub.amountInr)}
                                      </>
                                      {isYearly &&
                                        ` (${formatCurrency(Math.round(monthlyEq(sub)))}/mo)`}
                                    </span>
                                  </div>
                                  <div className="sub-actions">
                                    <button
                                      type="button"
                                      className="sub-icon-btn"
                                      title="Edit"
                                      onClick={() => {
                                        setEditSub({
                                          service: sub.service,
                                          amount_inr: String(sub.amountInr),
                                          billing_cycle: sub.billingCycle,
                                          next_due_date: sub.nextDueDate,
                                          notes: sub.notes,
                                          category: sub.category,
                                        });
                                        setShowSubModal(true);
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    {cancellingSub === sub.service ? (
                                      <span className="sub-cancelling">
                                        Cancelling…
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="sub-action"
                                        onClick={async () => {
                                          setCancellingSub(sub.service);
                                          try {
                                            await cancelSubscriptionM.mutateAsync(
                                              sub.service,
                                            );
                                            await refreshPanel();
                                          } catch {
                                            setCancellingSub(null);
                                          }
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </details>

                        <details className="subscription-accordion">
                          <summary>
                            <h4>
                              Cancelled ({panel.subscriptions.cancelled.length})
                            </h4>
                            <span className="chevron" aria-hidden="true">
                              ▾
                            </span>
                          </summary>
                          {panel.subscriptions.cancelled.length ? (
                            <ul className="sub-list">
                              {panel.subscriptions.cancelled.map((sub) => (
                                <li key={sub.service} className="sub-row">
                                  <div className="sub-row-info">
                                    <strong>{sub.service}</strong>
                                    <span className="sub-meta">
                                      {sub.renewalOrEndMonth ?? "n/a"}
                                    </span>
                                  </div>
                                  <div className="sub-actions">
                                    <button
                                      type="button"
                                      className="sub-icon-btn"
                                      title="Edit"
                                      onClick={() => {
                                        setEditSub({
                                          service: sub.service,
                                          amount_inr: String(sub.amountInr),
                                          billing_cycle: sub.billingCycle,
                                          next_due_date: sub.nextDueDate,
                                          notes: sub.notes,
                                          category: sub.category,
                                        });
                                        setShowSubModal(true);
                                      }}
                                    >
                                      ✏️
                                    </button>
                                    {reactivatingSub === sub.service ? (
                                      <span className="sub-cancelling">
                                        Reactivating…
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        className="sub-action"
                                        onClick={async () => {
                                          setReactivatingSub(sub.service);
                                          try {
                                            await reactivateSubscriptionM.mutateAsync(
                                              sub.service,
                                            );
                                            await refreshPanel();
                                          } catch {
                                            setReactivatingSub(null);
                                          }
                                        }}
                                      >
                                        Reactivate
                                      </button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted">
                              No cancelled subscriptions found.
                            </p>
                          )}
                        </details>
                      </div>
                    </>
                  );
                })()}
              </article>
        </div>
        <div className="erd-right-col">
          {envelopeState && (
            <div className="erd-hero-row">
              <ReadyToAssignBanner
                income={envelopeState.income}
                totalAssigned={envelopeState.totalAssigned}
                readyToAssign={envelopeState.readyToAssign}
                isOverAssigned={envelopeState.isOverAssigned}
                onIncomeChange={handleIncomeChange}
                sparkData={panel.miniTrend.slice(-7)}
                overspentCount={overspentCount}
                totalEnvelopes={envelopeState.envelopes.length}
              />
            </div>
          )}

          {showRolloverBanner && rolloverData && (
            <MonthRolloverBanner
              currentMonth={panel.month}
              lastMonth={rolloverData.lastMonth}
              lastIncome={rolloverData.lastIncome}
              lastAssignments={rolloverData.lastAssignments}
              onConfirm={handleRolloverConfirm}
              onDismiss={handleRolloverDismiss}
            />
          )}

        </div>
        </div>
        <AnimatePresence>
          {showCategoryManager && (
            <CategoryManager
              onClose={() => setShowCategoryManager(false)}
              onSaved={refreshPanel}
              envelopes={envelopeState?.envelopes ?? null}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showSubModal && (
            <SubscriptionModal
              onClose={() => {
                setShowSubModal(false);
                setEditSub(null);
              }}
              onSaved={() => {
                setShowSubModal(false);
                setEditSub(null);
                refreshPanel();
              }}
              editData={editSub ?? undefined}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {payCreditCardAmount !== null && envelopeState && (
            <Scrim
              className="modal-overlay"
              onClick={() => setPayCreditCardAmount(null)}
            >
              <Sheet
                className="modal-content move-money-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="move-money-header">
                  <h4>Pay Credit Card Bill</h4>
                  <button
                    type="button"
                    className="move-money-close"
                    onClick={() => setPayCreditCardAmount(null)}
                    disabled={payPhase.saving || payPhase.success}
                  >
                    ✕
                  </button>
                </div>
                <p className="move-money-desc">
                  Pay the full outstanding balance of{" "}
                  {formatCurrency(payCreditCardAmount)} from your bank account?
                </p>
                <div className="move-money-actions">
                  <button
                    type="button"
                    className="move-money-cancel"
                    onClick={() => setPayCreditCardAmount(null)}
                    disabled={payPhase.saving || payPhase.success}
                  >
                    Cancel
                  </button>
                  <SuccessButton
                    type="button"
                    disabled={payPhase.saving || payPhase.success}
                    saving={payPhase.saving}
                    success={payPhase.success}
                    onClick={async () => {
                      if (payPhase.saving || payPhase.success || payCreditCardAmount == null) return;
                      payPhase.start();
                      try {
                        await confirmPayCreditCard(payCreditCardAmount);
                        payPhase.succeed(() => setPayCreditCardAmount(null));
                      } catch {
                        payPhase.fail();
                        setActionError("Couldn't record the payment — check your connection.");
                      }
                    }}
                  >
                    Pay {formatCurrency(payCreditCardAmount)}
                  </SuccessButton>
                </div>
              </Sheet>
            </Scrim>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {moveMoneyTarget && envelopeState && (
            <MoveMoneyModal
              targetCategory={moveMoneyTarget}
              envelopes={envelopeState.envelopes}
              readyToAssign={envelopeState.readyToAssign}
              onClose={() => setMoveMoneyTarget(null)}
              onTransfer={async (from, to, amount) => {
                if (!envelopeState) return;
                // Server computes the transfer from current DB state in one
                // transaction — local state below only mirrors the result,
                // it doesn't drive it. Awaited first: a failed transfer must
                // never touch local state or look like it moved money.
                await transferBudgetM.mutateAsync({
                  month: envelopeState.month,
                  to,
                  sources: [{ category: from, amount }],
                });
                setEnvelopeState((prev) => {
                  if (!prev) return prev;
                  if (from === "__ready_to_assign__") {
                    const updated = prev.envelopes.map((e) =>
                      e.category === to
                        ? {
                            ...e,
                            assigned: e.assigned + amount,
                            available: e.available + amount,
                          }
                        : e,
                    );
                    const totalAssigned = updated.reduce(
                      (s, e) => s + e.assigned,
                      0,
                    );
                    const rta = Math.round(prev.income - totalAssigned) || 0;
                    return {
                      ...prev,
                      envelopes: updated,
                      totalAssigned,
                      readyToAssign: rta,
                      isOverAssigned: rta < 0,
                    };
                  }
                  const updated = prev.envelopes.map((e) => {
                    if (e.category === from)
                      return {
                        ...e,
                        assigned: e.assigned - amount,
                        available: e.available - amount,
                      };
                    if (e.category === to)
                      return {
                        ...e,
                        assigned: e.assigned + amount,
                        available: e.available + amount,
                      };
                    return e;
                  });
                  const totalAssigned = updated.reduce(
                    (s, e) => s + e.assigned,
                    0,
                  );
                  const rta = Math.round(prev.income - totalAssigned) || 0;
                  return {
                    ...prev,
                    envelopes: updated,
                    totalAssigned,
                    readyToAssign: rta,
                    isOverAssigned: rta < 0,
                  };
                });
              }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showBulkReturnConfirm &&
            envelopeState &&
            (() => {
              const positive = envelopeState.envelopes.filter(
                (e) => e.available > 0,
              );
              const total = positive.reduce((s, e) => s + e.available, 0);
              return (
                <Scrim
                  className="move-money-overlay"
                  onClick={() => setShowBulkReturnConfirm(false)}
                >
                  <Sheet
                    className="move-money-modal"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="move-money-header">
                      <h4>Return all to Ready to Assign</h4>
                      <button
                        type="button"
                        className="move-money-close"
                        onClick={() => setShowBulkReturnConfirm(false)}
                        disabled={bulkReturnPhase.saving || bulkReturnPhase.success}
                      >
                        ✕
                      </button>
                    </div>
                    {positive.length === 0 ? (
                      <p className="move-money-empty">
                        No categories with leftover available balance.
                      </p>
                    ) : (
                      <>
                        <p className="move-money-desc">
                          Move <strong>{formatCurrency(total)}</strong> from{" "}
                          {positive.length} categor
                          {positive.length === 1 ? "y" : "ies"} back to Ready to
                          Assign. Each category&apos;s Available will reset to ₹0.
                        </p>
                        <div className="bulk-return-list">
                          {positive.map((e) => (
                            <div key={e.category} className="bulk-return-row">
                              <span>{e.category}</span>
                              <span className="num">
                                {formatCurrency(e.available)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="move-money-actions">
                          <button
                            type="button"
                            className="action-button"
                            onClick={() => setShowBulkReturnConfirm(false)}
                            disabled={bulkReturnPhase.saving || bulkReturnPhase.success}
                          >
                            Cancel
                          </button>
                          <SuccessButton
                            type="button"
                            className="is-active"
                            disabled={bulkReturnPhase.saving || bulkReturnPhase.success}
                            saving={bulkReturnPhase.saving}
                            success={bulkReturnPhase.success}
                            onClick={handleBulkReturnToRTA}
                          >
                            Return {formatCurrency(total)} to RTA
                          </SuccessButton>
                        </div>
                      </>
                    )}
                  </Sheet>
                </Scrim>
              );
            })()}
        </AnimatePresence>
        {showFluidDemo && (
          <Scrim onClick={() => setShowFluidDemo(false)}>
            <Sheet>
              <FluidDemo />
              <button
                type="button"
                className="action-button is-ghost"
                onClick={() => setShowFluidDemo(false)}
                style={{ marginTop: "24px" }}
              >
                Close Demo
              </button>
            </Sheet>
          </Scrim>
        )}
      </div>
      <nav className="erd-tabbar" aria-label="Primary">
        <Link href="/expense" className="erd-tab">
          <span aria-hidden="true">🏠</span>
          <span>Home</span>
        </Link>
        <Link href="/expense/transactions" className="erd-tab">
          <span aria-hidden="true">🧾</span>
          <span>Activity</span>
        </Link>
        <button
          type="button"
          className="erd-tab-fab"
          onClick={() => setShowLogModal(true)}
          aria-label="Log expense"
        >
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
      <AnimatePresence>
        {showLogModal && (
          <LogExpenseModal
            onClose={() => setShowLogModal(false)}
            onSaved={refreshPanel}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
