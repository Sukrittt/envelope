import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { Fredoka, Nunito } from "next/font/google";
import { useAppearance } from "../../components/AppearanceProvider";
import { SparkBars } from "../components/SparkBars";
import { FluidDemo } from "../components/FluidDemo";
import { ReadyToAssignBanner } from "../components/ReadyToAssignBanner";
import { EnvelopeGrid } from "../components/EnvelopeGrid";
import { MoveMoneyModal } from "../components/MoveMoneyModal";
import { ExpenseSidebar } from "../components/ExpenseSidebar";
import { CategoryManager } from "../components/CategoryManager";
import { SubscriptionModal } from "../components/SubscriptionModal";
import { Scrim, Sheet } from "../components/MotionSheet";
import { SpendingInsights } from "../components/SpendingInsights";
import { LoadingCaption } from "../components/LoadingCaption";
import {
  cancelSubscription,
  reactivateSubscription,
  addBudget,
  updateBudget,
  getBudgets,
  getCategories,
  addExpense,
} from "../services/api";
import {
  toExpensePanelData,
  type ExpensePanelData,
} from "../services/expensePanelAdapter";
import {
  loadExpensePanelContract,
  loadEnvelopeStateForMonth,
} from "../services/expensePanelLoader";
import { MonthRolloverBanner } from "../components/MonthRolloverBanner";
import { LogExpenseModal } from "../components/LogExpenseModal";
import { SuccessButton, useButtonPhase } from "../components/SuccessButton";
import type { BudgetRow, Envelope, EnvelopeState } from "../types/expense";

// Portal content (date-range-menu, below) is appended to document.body, outside
// the .expense-redesign DOM subtree, so it can't inherit --font-fredoka /
// --font-nunito from the route wrapper. Load them here too and apply the
// variable classNames directly on the portal root.
const fredoka = Fredoka({ subsets: ["latin"], weight: ["600"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

type PeriodKey = "7d" | "30d" | "mtd" | "custom";
type TrendView = "daily" | "weekly" | "monthly";
type DrillFilter = { start: string; end: string; parentView: TrendView } | null;
type ActiveSubscription = ExpensePanelData["subscriptions"]["active"][number];

function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function weekKey(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const start = new Date(date);
  const diffToMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  return start.toISOString().slice(0, 10);
}

function monthKey(input: string): string {
  return input.slice(0, 7);
}

function monthRangeFromKey(key: string): { start: string; end: string } {
  const d = new Date(`${key}-01`);
  const start = d.toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

function weekRangeFromKey(startIso: string): { start: string; end: string } {
  const d = new Date(startIso);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return {
    start: d.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function weekRangeLabel(startIso: string): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}-${end.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
    },
  )}`;
}

// type ExpenseTab = 'overview' | 'transactions' | 'insights'

export function ExpensePage() {
  // TESTING ONLY — set true to pin the page on the loading skeleton.
  const FORCE_LOADING_SKELETON = false;
  const { data: contract, mutate: mutatePanel } = useSWR(
    "expense-panel-contract",
    loadExpensePanelContract,
  );
  const panel = useMemo(
    () => (contract ? toExpensePanelData(contract) : null),
    [contract],
  );
  // const [activeTab, setActiveTab] = useState<ExpenseTab>('overview')
  const [period, setPeriod] = useState<PeriodKey>("mtd");
  const [trendView, setTrendView] = useState<TrendView>("weekly");
  const [drillFilter, setDrillFilter] = useState<DrillFilter>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeMenu, setActiveMenu] = useState<"category" | "date" | null>(
    null,
  );
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const isCategoryMenuOpen = activeMenu === "category";
  const isDateMenuOpen = activeMenu === "date";
  const [hideAmounts, setHideAmounts] = useState<boolean>(false);
  const [dailyDetailDate, setDailyDetailDate] = useState<string | null>(null);
  const [envelopeState, setEnvelopeState] = useState<EnvelopeState | null>(
    null,
  );
  const [insightMonth, setInsightMonth] = useState<string | null>(null);
  const [insightEnvelopes, setInsightEnvelopes] = useState<Envelope[] | null>(
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
  } | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [chartType, setChartType] = useState<"area" | "bar">("area");
  const { theme, setTheme } = useAppearance();

  // Restore the "hide amounts" preference after hydration so the server and
  // client render the same initial output (avoids a hydration mismatch).
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("expense-hide-amounts") === "true"
    ) {
      setHideAmounts(true);
    }
  }, []);

  async function refreshPanel() {
    try {
      await mutatePanel();
    } catch {
      // silent
    }
    setCancellingSub(null);
    setReactivatingSub(null);
  }

  // Keep envelopeState in sync with the panel contract, while still allowing
  // optimistic local updates (handleIncomeChange, handleAssignFromRTA, etc.)
  // to apply in between contract refreshes.
  useEffect(() => {
    if (panel) setEnvelopeState(panel.envelopeState);
  }, [panel]);

  async function handleInsightNavigate(delta: number) {
    const base =
      insightMonth ?? panel?.month ?? new Date().toISOString().slice(0, 7);
    const d = new Date(`${base}-01`);
    d.setMonth(d.getMonth() + delta);
    const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const current =
      envelopeState?.month ?? new Date().toISOString().slice(0, 7);
    if (target > current) return;
    setInsightMonth(target);
    try {
      const st = await loadEnvelopeStateForMonth(target);
      setInsightEnvelopes(st.envelopes);
    } catch {
      setInsightEnvelopes(null);
    }
  }

  async function handleIncomeChange(newIncome: number) {
    const month = envelopeState?.month;
    const income = Math.round(newIncome) || 0;
    if (month) {
      try {
        await updateBudget(month, "__income__", { assigned: String(income) });
      } catch {
        await addBudget({
          month,
          category: "__income__",
          assigned: String(income),
        });
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
        updateBudget(month, category, { assigned: String(newAssigned) }).catch(
          () => {},
        );
      } else {
        addBudget({ month, category, assigned: String(amount) }).catch(
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
      updateBudget(prev.month, category, { assigned: String(assigned) }).catch(
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
          updateBudget(month, e.category, {
            assigned: String(e.assigned - e.available),
          }).catch(() => {});
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
    try {
      await addExpense({
        item: "Credit Card Payment",
        amount_inr: String(amount),
        category: "__credit_card__",
        payment_method: "bank",
      });
      await refreshPanel();
    } catch {
      // silent
    }
  }

  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);
  const dateTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!panel) return;
    const override = localStorage.getItem("expense-income-override");
    if (override === null) return;
    const value = Math.round(Number(override)) || 0;
    const month = panel.month;
    (async () => {
      try {
        await updateBudget(month, "__income__", { assigned: String(value) });
      } catch {
        await addBudget({
          month,
          category: "__income__",
          assigned: String(value),
        });
      }
      localStorage.removeItem("expense-income-override");
    })();
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    const storedMonth = localStorage.getItem("budget-active-month");
    if (storedMonth === panel.month) return;
    const p = panel;

    async function checkRollover() {
      const budgets: BudgetRow[] = (await getBudgets().catch(() => [])).map(
        (r) => ({
          month: r.month,
          category: r.category,
          assigned: Number(r.assigned),
          rolledOver: Number(r.rolled_over),
        }),
      );

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
  }, [panel]);

  function prevMonth(key: string): string {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  async function handleRolloverConfirm(income: number, copyAssigned: boolean) {
    const p = panel;
    if (!p) return;
    const month = p.month;
    const lastMonthKey = prevMonth(month);

    const budgets: BudgetRow[] = (await getBudgets().catch(() => [])).map(
      (r) => ({
        month: r.month,
        category: r.category,
        assigned: Number(r.assigned),
        rolledOver: Number(r.rolled_over),
      }),
    );
    const categories = await getCategories().catch(() => []);
    const categoryNames = categories.map((c) => c.name);

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
    await addBudget({
      month,
      category: "__income__",
      assigned: String(effectiveIncome),
    }).catch(() => {});

    const allCategoryNames = [
      ...new Set([...categoryNames, ...lastMonthRows.map((r) => r.category)]),
    ];
    for (const cat of allCategoryNames) {
      const lastRow = lastMonthRows.find((r) => r.category === cat);
      const assigned = copyAssigned && lastRow ? lastRow.assigned : 0;
      await addBudget({
        month,
        category: cat,
        assigned: String(assigned),
      }).catch(() => {});
    }

    localStorage.setItem("budget-active-month", month);
    await refreshPanel();
  }

  function handleRolloverDismiss() {
    setShowRolloverBanner(false);
    setRolloverData(null);
  }

  const latestDate = useMemo(() => {
    if (!panel) return new Date();
    const last = panel.miniTrend.at(-1)?.date ?? panel.month;
    const date = new Date(last);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [panel]);

  const [customStart, setCustomStart] = useState<string>(
    toDateInputValue(
      new Date(latestDate.getFullYear(), latestDate.getMonth(), 1),
    ),
  );
  const [customEnd, setCustomEnd] = useState<string>(
    toDateInputValue(latestDate),
  );
  const [draftStart, setDraftStart] = useState<string>(customStart);
  const [draftEnd, setDraftEnd] = useState<string>(customEnd);

  const draftStartTime = new Date(draftStart).getTime();
  const draftEndTime = new Date(draftEnd).getTime();
  const isDateRangeInvalid =
    Number.isNaN(draftStartTime) ||
    Number.isNaN(draftEndTime) ||
    draftStartTime > draftEndTime;

  function openDateMenu() {
    setDraftStart(customStart);
    setDraftEnd(customEnd);
    setActiveMenu("date");
  }

  function applyDateRange() {
    if (isDateRangeInvalid) return;
    setCustomStart(draftStart);
    setCustomEnd(draftEnd);
    setActiveMenu(null);
  }

  function cancelDateRange() {
    setActiveMenu(null);
  }

  const categoryOptions = useMemo(
    () => panel?.topCategories.map((category) => category.category) ?? [],
    [panel],
  );
  const allCategoriesSelected = selectedCategories.length === 0;

  function selectAllCategories() {
    setSelectedCategories([]);
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category],
    );
  }

  useEffect(() => {
    if (!activeMenu) return;

    const menuRef = activeMenu === "category" ? categoryMenuRef : dateMenuRef;
    const triggerRef =
      activeMenu === "category" ? categoryTriggerRef : dateTriggerRef;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setActiveMenu(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeMenu]);

  useEffect(() => {
    if (!activeMenu) return;

    const triggerRef =
      activeMenu === "category" ? categoryTriggerRef : dateTriggerRef;

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const horizontalPadding = 16;
      const minWidth = rect.width;
      const left = Math.max(
        horizontalPadding,
        rect.right - Math.max(minWidth, 270),
      );
      setMenuPosition({
        top: rect.bottom + 6,
        left,
        minWidth,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeMenu]);

  const filteredTrend = useMemo(() => {
    if (!panel) return [];
    const rows = [...panel.miniTrend];
    const end = new Date(latestDate);
    let start = new Date(rows[0]?.date ?? end);

    if (period === "7d") {
      start = new Date(end);
      start.setDate(end.getDate() - 6);
    } else if (period === "30d") {
      start = new Date(end);
      start.setDate(end.getDate() - 29);
    } else if (period === "mtd") {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else {
      const parsedStart = new Date(customStart);
      const parsedEnd = new Date(customEnd);
      if (
        !Number.isNaN(parsedStart.getTime()) &&
        !Number.isNaN(parsedEnd.getTime())
      ) {
        start = parsedStart;
        if (parsedEnd.getTime() < end.getTime()) {
          end.setTime(parsedEnd.getTime());
        }
      }
    }

    return rows.filter((row) => {
      const date = new Date(row.date);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
  }, [customEnd, customStart, latestDate, panel, period]);

  const categoryScopeRatio = useMemo(() => {
    if (!panel || !selectedCategories.length) return 1;
    const catTotal = panel.topCategories.reduce((s, r) => s + r.amountInr, 0);
    if (!catTotal) return 1;
    const selTotal = panel.topCategories
      .filter((row) => selectedCategories.includes(row.category))
      .reduce((s, r) => s + r.amountInr, 0);
    return selTotal / catTotal;
  }, [panel, selectedCategories]);

  const dailyCategoryMap = useMemo(() => {
    if (!panel) return new Map<string, Record<string, number>>();
    const map = new Map<string, Record<string, number>>();
    for (const row of panel.expenseRows) {
      const prev = map.get(row.date) ?? {};
      prev[row.category] = (prev[row.category] ?? 0) + row.amountInr;
      map.set(row.date, prev);
    }
    return map;
  }, [panel]);

  const trendSeries = useMemo(() => {
    const useFullHistory =
      trendView === "monthly" || drillFilter?.parentView === "monthly";
    const baseRows = useFullHistory && panel ? panel.miniTrend : filteredTrend;
    let source = baseRows.map((row) => ({
      ...row,
      value: row.value * categoryScopeRatio,
    }));

    if (drillFilter) {
      source = source.filter(
        (row) => row.date >= drillFilter.start && row.date <= drillFilter.end,
      );
    }

    if (trendView === "daily") {
      if (!drillFilter && (period === "7d" || period === "30d")) {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const startOfWeek = new Date(now);
        const diffToMonday = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(now.getDate() - diffToMonday);
        const weekStart = startOfWeek.toISOString().slice(0, 10);
        source = source.filter(
          (row) => row.date >= weekStart && row.date <= today,
        );
      }

      const byDate = new Map(source.map((row) => [row.date, row.value]));
      const startIso = drillFilter ? drillFilter.start : source[0]?.date;
      const endIso = drillFilter
        ? drillFilter.end
        : source[source.length - 1]?.date;
      if (!startIso || !endIso)
        return source.map((row) => ({ date: row.date, value: row.value }));

      const out: {
        date: string;
        value: number;
        categories?: Record<string, number>;
      }[] = [];
      const cursor = new Date(startIso);
      const end = new Date(endIso);
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        const rawCats = dailyCategoryMap.get(key);
        const categories =
          rawCats && allCategoriesSelected
            ? rawCats
            : rawCats && selectedCategories.length > 0
              ? Object.fromEntries(
                  Object.entries(rawCats).filter(([cat]) =>
                    selectedCategories.includes(cat),
                  ),
                )
              : undefined;
        out.push({ date: key, value: byDate.get(key) ?? 0, categories });
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    }

    if (trendView === "weekly") {
      const byWeek = new Map<string, number>();
      source.forEach((row) => {
        const key = weekKey(row.date);
        byWeek.set(key, (byWeek.get(key) ?? 0) + row.value);
      });

      return [...byWeek.entries()].map(([date, value]) => ({
        date: weekRangeLabel(date),
        value,
      }));
    }

    const byMonth = new Map<string, number>();
    source.forEach((row) => {
      const key = row.date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + row.value);
    });

    return [...byMonth.entries()].map(([date, value]) => ({
      date,
      value,
    }));
  }, [
    categoryScopeRatio,
    allCategoriesSelected,
    dailyCategoryMap,
    drillFilter,
    filteredTrend,
    trendView,
    panel,
    selectedCategories,
  ]);

  const trendKeys = useMemo(() => {
    const useFullHistory =
      trendView === "monthly" || drillFilter?.parentView === "monthly";
    let source = useFullHistory && panel ? panel.miniTrend : filteredTrend;
    if (drillFilter) {
      source = source.filter(
        (row) => row.date >= drillFilter.start && row.date <= drillFilter.end,
      );
    }
    if (trendView === "daily") return source.map((row) => row.date);
    if (trendView === "weekly") {
      const keys: string[] = [];
      const seen = new Set<string>();
      source.forEach((row) => {
        const k = weekKey(row.date);
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      });
      return keys;
    }
    const keys: string[] = [];
    const seen = new Set<string>();
    source.forEach((row) => {
      const k = monthKey(row.date);
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    });
    return keys;
  }, [drillFilter, filteredTrend, trendView, panel]);

  function handleBarClick(index: number) {
    if (trendView === "monthly") {
      const key = trendKeys[index];
      if (!key) return;
      const range = monthRangeFromKey(key);
      setDrillFilter({ ...range, parentView: "monthly" });
      setTrendView("weekly");
    } else if (trendView === "weekly") {
      const key = trendKeys[index];
      if (!key) return;
      const range = weekRangeFromKey(key);
      setDrillFilter({ ...range, parentView: "weekly" });
      setTrendView("daily");
    }
  }

  function handleDrillBack() {
    if (drillFilter) {
      setTrendView(drillFilter.parentView);
      setDrillFilter(null);
    }
  }

  function formatDrillRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const sameMonth =
      s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      const month = e.toLocaleDateString("en-IN", { month: "short" });
      return `${s.getDate()}–${e.getDate()} ${month}`;
    }
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    return `${fmt(s)} – ${fmt(e)}`;
  }

  function handleDailyBarClick(index: number) {
    const entry = trendSeries[index];
    if (!entry) return;
    setDailyDetailDate(entry.date);
  }

  const dailyDetailRows = useMemo(() => {
    if (!dailyDetailDate || !panel) return [];
    return panel.expenseRows
      .filter((row) => row.date === dailyDetailDate)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [dailyDetailDate, panel]);

  const dailyDetailTotal = useMemo(
    () => dailyDetailRows.reduce((sum, row) => sum + row.amountInr, 0),
    [dailyDetailRows],
  );

  useEffect(() => {
    if (!dailyDetailDate) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDailyDetailDate(null);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dailyDetailDate]);

  const categoryScopeLabel = selectedCategories.length
    ? `${selectedCategories.length} selected`
    : "All categories";

  if (!panel || FORCE_LOADING_SKELETON) {
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
            {/* RTA hero + income card */}
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

              <div className="erd-card erd-income-card">
                <div>
                  <div
                    className="erd-skeleton"
                    style={{
                      width: "72px",
                      height: "11px",
                      borderRadius: "5px",
                    }}
                  />
                  <div
                    className="erd-skeleton"
                    style={{
                      width: "130px",
                      height: "20px",
                      borderRadius: "7px",
                      marginTop: "6px",
                    }}
                  />
                </div>
                <div className="erd-income-spark" aria-hidden="true">
                  {[6, 10, 8, 14, 9, 12, 16, 11].map((h, i) => (
                    <span
                      key={i}
                      className="erd-skeleton"
                      style={{
                        width: "4px",
                        height: `${h}px`,
                        borderRadius: "4px",
                      }}
                    />
                  ))}
                </div>
                <div className="erd-card-divider" />
                {[0, 1].map((i) => (
                  <div key={i} className="erd-income-row">
                    <span
                      className="erd-skeleton"
                      style={{
                        width: i === 0 ? "48px" : "60px",
                        height: "11px",
                        borderRadius: "5px",
                      }}
                    />
                    <span
                      className="erd-skeleton"
                      style={{
                        width: "72px",
                        height: "11px",
                        borderRadius: "5px",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

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

            <div className="expense-grid-xman">
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

              {/* Insights + subscriptions */}
              <div className="erd-bottom-row">
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
                  <div
                    className="erd-subs-totals"
                    style={{ marginTop: "12px" }}
                  >
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
            </div>
          </div>
        </div>

        {/* ── Mobile tabbar skeleton ── */}
        <nav className="erd-tabbar" aria-label="Primary" aria-hidden="true">
          {["🏠", "🧾"].map((icon) => (
            <span key={icon} className="erd-tab">
              <span aria-hidden="true">{icon}</span>
              <span
                className="erd-skeleton"
                style={{ width: "34px", height: "8px", borderRadius: "4px" }}
              />
            </span>
          ))}
          <span className="erd-tab-fab erd-skeleton" aria-hidden="true" />
          {["🧺", "⚙️"].map((icon) => (
            <span key={icon} className="erd-tab">
              <span aria-hidden="true">{icon}</span>
              <span
                className="erd-skeleton"
                style={{ width: "34px", height: "8px", borderRadius: "4px" }}
              />
            </span>
          ))}
        </nav>
      </section>
    );
  }

  const isCategoryMenuVisible = Boolean(isCategoryMenuOpen && menuPosition);
  const isDateMenuVisible = Boolean(isDateMenuOpen && menuPosition);
  const resolvedMenuPosition =
    menuPosition ??
    ({
      top: 0,
      left: 0,
      minWidth: 140,
    } as const);

  const categoryMenu = createPortal(
    <div
      className="category-menu category-menu--portal"
      role="menu"
      aria-label="Category filter menu"
      aria-hidden={!isCategoryMenuVisible}
      ref={categoryMenuRef}
      style={{
        position: "fixed",
        top: `${resolvedMenuPosition.top}px`,
        left: `${resolvedMenuPosition.left}px`,
        minWidth: `${resolvedMenuPosition.minWidth}px`,
        display: isCategoryMenuVisible ? "grid" : "none",
        pointerEvents: isCategoryMenuVisible ? "auto" : "none",
      }}
    >
      <div className="category-menu-list">
        <button
          type="button"
          className={`action-button is-ghost category-option category-option--all ${allCategoriesSelected ? "is-selected" : ""}`}
          onClick={selectAllCategories}
        >
          <input
            type="checkbox"
            readOnly
            checked={allCategoriesSelected}
            tabIndex={-1}
            aria-hidden="true"
          />
          All categories
        </button>

        {categoryOptions.map((category) => {
          const isSelected = selectedCategories.includes(category);
          return (
            <button
              type="button"
              key={category}
              className={`action-button is-ghost category-option ${isSelected ? "is-selected" : ""}`}
              onClick={() => toggleCategory(category)}
            >
              <input
                type="checkbox"
                readOnly
                checked={isSelected}
                tabIndex={-1}
                aria-hidden="true"
              />
              {category}
            </button>
          );
        })}
      </div>

      {!allCategoriesSelected ? (
        <div className="category-menu-actions">
          <button
            type="button"
            className="action-button is-ghost"
            onClick={selectAllCategories}
          >
            Clear category filters
          </button>
        </div>
      ) : null}
    </div>,
    document.body,
  );

  const dateMenu = createPortal(
    <div
      className={`category-menu category-menu--portal date-range-menu ${fredoka.variable} ${nunito.variable} ${isDateMenuVisible ? "is-open" : ""}`}
      role="menu"
      aria-label="Custom date range"
      aria-hidden={!isDateMenuVisible}
      ref={dateMenuRef}
      style={{
        position: "fixed",
        top: `${resolvedMenuPosition.top}px`,
        left: `${resolvedMenuPosition.left}px`,
        minWidth: `${resolvedMenuPosition.minWidth}px`,
        display: "grid",
        pointerEvents: isDateMenuVisible ? "auto" : "none",
      }}
    >
      <div className="date-range-fields">
        <div className="date-range-field">
          <label htmlFor="expense-custom-start">From</label>
          <input
            id="expense-custom-start"
            type="date"
            value={draftStart}
            onChange={(event) => setDraftStart(event.target.value)}
            aria-label="Custom start date"
          />
        </div>
        <span className="date-range-arrow" aria-hidden="true">
          →
        </span>
        <div className="date-range-field">
          <label htmlFor="expense-custom-end">To</label>
          <input
            id="expense-custom-end"
            type="date"
            value={draftEnd}
            onChange={(event) => setDraftEnd(event.target.value)}
            aria-label="Custom end date"
          />
        </div>
      </div>

      <div className="date-range-menu-actions">
        <button
          type="button"
          className="date-range-cancel"
          onClick={cancelDateRange}
        >
          Cancel
        </button>
        <button
          type="button"
          className="date-range-apply"
          onClick={applyDateRange}
          disabled={isDateRangeInvalid}
        >
          Apply
        </button>
      </div>
    </div>,
    document.body,
  );

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
      <button
        type="button"
        className="erd-theme-toggle"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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

          <section className="erd-card erd-scopebar" aria-label="Scope bar">
            <div role="group" aria-label="Period selector">
              <div role="tablist" aria-label="Period presets">
                <button
                  type="button"
                  className={`erd-pill ${period === "7d" ? "is-active" : ""}`}
                  onClick={() => setPeriod("7d")}
                >
                  Last 7 days
                </button>
                <button
                  type="button"
                  className={`erd-pill ${period === "30d" ? "is-active" : ""}`}
                  onClick={() => setPeriod("30d")}
                >
                  Last 30 days
                </button>
                <button
                  type="button"
                  className={`erd-pill ${period === "mtd" ? "is-active" : ""}`}
                  onClick={() => setPeriod("mtd")}
                >
                  Month to date
                </button>
                <button
                  type="button"
                  className={`erd-pill ${period === "custom" ? "is-active" : ""}`}
                  onClick={() => {
                    setPeriod("custom");
                    if (isDateMenuOpen) {
                      setActiveMenu(null);
                    } else {
                      openDateMenu();
                    }
                  }}
                  aria-haspopup="menu"
                  aria-expanded={isDateMenuOpen}
                  ref={dateTriggerRef}
                >
                  Custom range
                </button>
              </div>
            </div>

            <div className="erd-scope-spacer" />

            <div className="erd-scope-meta" aria-label="Scope status">
              <span
                className="category-trigger"
                onClick={() =>
                  setActiveMenu((menu) => (menu === "category" ? null : "category"))
                }
                ref={categoryTriggerRef}
              >
                <span>{categoryScopeLabel}</span>
                <span aria-hidden="true">▾</span>
              </span>
              <button
                type="button"
                className="erd-log-btn"
                onClick={() => setShowLogModal(true)}
              >
                + Log expense
              </button>
            </div>
          </section>

          <div className="expense-grid-xman">
            <article className="erd-card erd-trend-panel">
              <div className="erd-panel-head">
                <div className="erd-panel-title">
                  {drillFilter && (
                    <button
                      type="button"
                      className="erd-title-back"
                      onClick={handleDrillBack}
                      aria-label="Back to Spending trend"
                      title="Back"
                    >
                      <svg viewBox="0 0 20 20" fill="none">
                        <path
                          d="M12.5 5.5 7 10l5.5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                  <div>
                    <h3>
                      {drillFilter
                        ? formatDrillRange(drillFilter.start, drillFilter.end)
                        : "Spending trend"}
                    </h3>
                    <p>How money flows, day by day</p>
                  </div>
                </div>
                <div className="erd-panel-tools">
                  <div className="erd-chart-icon-toggle">
                    <button
                      type="button"
                      className={`erd-chart-icon-btn ${chartType === "area" ? "is-active" : ""}`}
                      onClick={() => setChartType("area")}
                      aria-label="Area chart"
                      title="Area"
                    >
                      <svg viewBox="0 0 16 16" fill="none">
                        <path
                          d="M1 10c1.5 0 1.5-4 3-4s1.5 4 3 4 1.5-6 3-6 1.5 6 3 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`erd-chart-icon-btn ${chartType === "bar" ? "is-active" : ""}`}
                      onClick={() => setChartType("bar")}
                      aria-label="Bar chart"
                      title="Bars"
                    >
                      <svg viewBox="0 0 16 16" fill="none">
                        <rect
                          x="4"
                          y="3"
                          width="2.6"
                          height="10"
                          rx="1.3"
                          fill="currentColor"
                        />
                        <rect
                          x="9.4"
                          y="3"
                          width="2.6"
                          height="10"
                          rx="1.3"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                  <span className="erd-tools-divider" aria-hidden="true" />
                  <div className="erd-view-toggle">
                    <button
                      type="button"
                      className={trendView === "daily" ? "is-active" : ""}
                      onClick={() => {
                        setTrendView("daily");
                        setDrillFilter(null);
                      }}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      className={trendView === "weekly" ? "is-active" : ""}
                      onClick={() => {
                        setTrendView("weekly");
                        setDrillFilter(null);
                      }}
                    >
                      Weekly
                    </button>
                    <button
                      type="button"
                      className={trendView === "monthly" ? "is-active" : ""}
                      onClick={() => {
                        setTrendView("monthly");
                        setDrillFilter(null);
                      }}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
              </div>
              <SparkBars
                data={trendSeries}
                size="expanded"
                variant={chartType}
                formatValue={(value) =>
                  hideAmounts ? "---" : formatCurrency(value)
                }
                capOutliers
                onBarClick={
                  trendView === "daily" ? handleDailyBarClick : handleBarClick
                }
                enableFluidInteractions
              />
              <AnimatePresence>
                {dailyDetailDate &&
                  createPortal(
                    <Scrim
                      className="daily-detail-overlay"
                      onClick={() => setDailyDetailDate(null)}
                    >
                      <Sheet
                        className="daily-detail-modal"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="daily-detail-header">
                          <h4>
                            {new Date(dailyDetailDate).toLocaleDateString(
                              "en-IN",
                              {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </h4>
                          <button
                            type="button"
                            className="daily-detail-close"
                            onClick={() => setDailyDetailDate(null)}
                            aria-label="Close"
                          >
                            ✕
                          </button>
                        </div>
                        {dailyDetailRows.length === 0 ? (
                          <p className="daily-detail-empty">
                            No transactions recorded for this day.
                          </p>
                        ) : (
                          <>
                            <table className="daily-detail-table">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>Item</th>
                                  <th>Category</th>
                                  <th className="num">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dailyDetailRows.map((row, i) => {
                                  const time = row.timestamp
                                    ? new Date(row.timestamp)
                                    : null;
                                  const timeStr =
                                    time && !Number.isNaN(time.getTime())
                                      ? time.toLocaleTimeString("en-IN", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "—";
                                  return (
                                    <tr key={`${row.timestamp}-${i}`}>
                                      <td className="daily-detail-time">
                                        {timeStr}
                                      </td>
                                      <td>{row.item}</td>
                                      <td>
                                        <span className="daily-detail-category">
                                          {row.category}
                                        </span>
                                      </td>
                                      <td
                                        className={`num ${hideAmounts ? "amount-hidden" : ""}`}
                                      >
                                        {hideAmounts
                                          ? "---"
                                          : formatCurrency(row.amountInr)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="daily-detail-footer">
                              <span>Total</span>
                              <span
                                className={`num ${hideAmounts ? "amount-hidden" : ""}`}
                              >
                                {hideAmounts
                                  ? "---"
                                  : formatCurrency(dailyDetailTotal)}
                              </span>
                            </div>
                          </>
                        )}
                      </Sheet>
                    </Scrim>,
                    document.body,
                  )}
              </AnimatePresence>
            </article>

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

            <div className="erd-bottom-row">
              <section className="erd-card erd-insights-panel">
                <SpendingInsights
                  envelopes={insightEnvelopes ?? envelopeState?.envelopes ?? []}
                  expenseRows={panel.expenseRows}
                  month={insightMonth ?? panel.month}
                  canGoNext={
                    (insightMonth ??
                      envelopeState?.month ??
                      new Date().toISOString().slice(0, 7)) <
                    (envelopeState?.month ??
                      new Date().toISOString().slice(0, 7))
                  }
                  onNavigate={handleInsightNavigate}
                />
              </section>

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

                  function rollForward(dateStr: string, cycle: string): string {
                    const d = new Date(dateStr);
                    if (Number.isNaN(d.getTime())) return "";
                    if (/yearly|annual/i.test(cycle))
                      d.setFullYear(d.getFullYear() + 1);
                    else if (/quarterly/i.test(cycle))
                      d.setMonth(d.getMonth() + 3);
                    else if (/weekly/i.test(cycle)) d.setDate(d.getDate() + 7);
                    else d.setMonth(d.getMonth() + 1);
                    return d.toISOString().slice(0, 10);
                  }

                  function getEffectiveDueDate(
                    sub: ActiveSubscription,
                  ): string {
                    if (sub.nextDueDate) {
                      let d = new Date(sub.nextDueDate);
                      if (Number.isNaN(d.getTime())) return "";
                      const now = new Date();
                      while (d <= now) {
                        const rolled = rollForward(
                          d.toISOString().slice(0, 10),
                          sub.billingCycle,
                        );
                        if (!rolled) break;
                        d = new Date(rolled);
                      }
                      return d.toISOString().slice(0, 10);
                    }
                    if (sub.renewalOrEndMonth) {
                      const months = [
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ];
                      const parts = sub.renewalOrEndMonth.split(" ");
                      if (parts.length >= 2) {
                        const m = months.indexOf(parts[0]);
                        const y = parseInt(parts[1]);
                        if (m >= 0 && !Number.isNaN(y))
                          return new Date(y, m, 1).toISOString().slice(0, 10);
                      }
                    }
                    if (sub.timestamp && /monthly/i.test(sub.billingCycle)) {
                      const start = new Date(sub.timestamp);
                      if (!Number.isNaN(start.getTime())) {
                        const now = new Date();
                        const next = new Date(
                          now.getFullYear(),
                          now.getMonth() + 1,
                          start.getDate(),
                        );
                        if (next <= now) next.setMonth(next.getMonth() + 1);
                        return next.toISOString().slice(0, 10);
                      }
                    }
                    return "";
                  }

                  function daysUntil(dateStr: string): string {
                    if (!dateStr) return "";
                    const diff = Math.round(
                      (new Date(dateStr).getTime() - new Date().getTime()) /
                        86400000,
                    );
                    if (diff < 0) return "";
                    if (diff === 0) return "renews today";
                    if (diff === 1) return "renews tomorrow";
                    return `renews in ${diff}d`;
                  }

                  function renewalDays(sub: ActiveSubscription): number {
                    if (/one-time/i.test(sub.billingCycle)) return Infinity;
                    const due = getEffectiveDueDate(sub);
                    if (!due) return Infinity;
                    return Math.round(
                      (new Date(due).getTime() - new Date().getTime()) /
                        86400000,
                    );
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
                                            await cancelSubscription(
                                              sub.service,
                                            );
                                            setTimeout(
                                              () => refreshPanel(),
                                              500,
                                            );
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
                                            await reactivateSubscription(
                                              sub.service,
                                            );
                                            setTimeout(
                                              () => refreshPanel(),
                                              500,
                                            );
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
                setTimeout(() => refreshPanel(), 500);
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
                      await confirmPayCreditCard(payCreditCardAmount);
                      payPhase.succeed(() => setPayCreditCardAmount(null));
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
              onTransfer={(from, to, amount) => {
                setEnvelopeState((prev) => {
                  if (!prev) return prev;
                  if (from === "__ready_to_assign__") {
                    const updated = prev.envelopes.map((e) => {
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
                    const current = prev.envelopes.find(
                      (e) => e.category === to,
                    );
                    const newAssigned = (current?.assigned ?? 0) + amount;
                    updateBudget(prev.month, to, {
                      assigned: String(newAssigned),
                    }).catch(() => {});
                    return {
                      ...prev,
                      envelopes: updated,
                      totalAssigned,
                      readyToAssign: rta,
                      isOverAssigned: rta < 0,
                    };
                  }
                  // Envelope-to-envelope transfer: persist both changes
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

                  // Persist both envelope updates to the database
                  const fromEnv = updated.find((e) => e.category === from);
                  const toEnv = updated.find((e) => e.category === to);
                  if (fromEnv) {
                    updateBudget(prev.month, from, {
                      assigned: String(fromEnv.assigned),
                    }).catch(() => {});
                  }
                  if (toEnv) {
                    updateBudget(prev.month, to, {
                      assigned: String(toEnv.assigned),
                    }).catch(() => {});
                  }

                  return {
                    ...prev,
                    envelopes: updated,
                    totalAssigned,
                    readyToAssign: rta,
                    isOverAssigned: rta < 0,
                  };
                });
                setMoveMoneyTarget(null);
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
                          Assign. Each category's Available will reset to ₹0.
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
        {categoryMenu}
        {dateMenu}
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
        <button
          type="button"
          className="erd-tab"
          onClick={() => setShowCategoryManager(true)}
        >
          <span aria-hidden="true">🧺</span>
          <span>Envelopes</span>
        </button>
        <Link href="/settings" className="erd-tab">
          <span aria-hidden="true">⚙️</span>
          <span>More</span>
        </Link>
      </nav>
      <AnimatePresence>
        {showLogModal && (
          <LogExpenseModal
            onClose={() => setShowLogModal(false)}
            onSaved={refreshPanel}
            categories={
              envelopeState?.envelopes
                .filter((e) => !e.isCreditCardPayment)
                .map((e) => e.category) ?? []
            }
          />
        )}
      </AnimatePresence>
    </section>
  );
}
