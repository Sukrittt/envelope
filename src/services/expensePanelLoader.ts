import type { ExpensePanelContract } from './expensePanelAdapter'
import { computeEnvelopes } from './budgetLoader'
import { getBudgets, getExpenses, getSubscriptions, getCategories, getGroups } from './api'
import type { EnvelopeState } from '../types/expense'

interface ExpenseRow {
  timestamp: string
  date: string
  item: string
  amountInr: number
  category: string
}

interface SubscriptionRow {
  timestamp: string
  service: string
  amountInr: number
  billingCycle: string
  nextDueDate: string
  status: string
  renewalOrEndMonth: string
  notes: string
  category: string
}

const ESSENTIAL_CATEGORIES = new Set(['Bills', 'Food', 'Travel', 'Personal care'])

export async function loadEnvelopeStateForMonth(month: string): Promise<EnvelopeState> {
  const [budgetRows, expenseRows, categoryRows, groupNames] = await Promise.all([
    getBudgets().catch(() => []),
    getExpenses().catch(() => []),
    getCategories().catch(() => []),
    getGroups().catch(() => []),
  ])
  const budgets = budgetRows.map((r) => ({
    month: r.month,
    category: r.category,
    assigned: Number(r.assigned) || 0,
    rolledOver: Number(r.rolled_over) || 0,
  }))
  const expenses = expenseRows.map((r) => ({
    date: r.date,
    amountInr: Number(r.amount_inr) || 0,
    category: r.category,
  }))
  return computeEnvelopes(budgets, expenses, month, categoryRows, groupNames)
}

export async function loadExpensePanelContract(): Promise<ExpensePanelContract> {
  const [apiExpenses, apiSubscriptions, budgetRows, categoryRows, groupNames] = await Promise.all([
    getExpenses().catch(() => []),
    getSubscriptions().catch(() => []),
    getBudgets().catch(() => []),
    getCategories().catch(() => []),
    getGroups().catch(() => []),
  ])

  const expenses: ExpenseRow[] = apiExpenses.map((r) => ({
    timestamp: r.timestamp,
    date: r.date,
    item: r.item,
    amountInr: Number(r.amount_inr) || 0,
    category: r.category,
  }))
  const subscriptions: SubscriptionRow[] = apiSubscriptions.map((r) => ({
    timestamp: r.timestamp,
    service: r.service,
    amountInr: Number(r.amount_inr) || 0,
    billingCycle: r.billing_cycle,
    nextDueDate: r.next_due_date ?? '',
    status: r.status,
    renewalOrEndMonth: r.renewal_or_end_month,
    notes: r.notes ?? '',
    category: r.category ?? '',
  }))
  const budgets = budgetRows.map((r) => ({
    month: r.month,
    category: r.category,
    assigned: Number(r.assigned) || 0,
    rolledOver: Number(r.rolled_over) || 0,
  }))

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const currentMonthRows = expenses.filter((e) => e.date.startsWith(currentMonth))
  const monthSpend = currentMonthRows.reduce((s, e) => s + e.amountInr, 0)

  const essentialSpend = currentMonthRows
    .filter((e) => ESSENTIAL_CATEGORIES.has(e.category))
    .reduce((s, e) => s + e.amountInr, 0)
  const discretionarySpend = monthSpend - essentialSpend

  // Top categories from current month
  const catTotals = new Map<string, number>()
  for (const e of currentMonthRows) {
    catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + e.amountInr)
  }
  const topCategories = [...catTotals.entries()]
    .map(([category, amountInr]) => ({ category, amountInr }))
    .sort((a, b) => b.amountInr - a.amountInr)

  // Daily spend — ALL rows, not just current month, so period filters work
  const dayTotals = new Map<string, number>()
  for (const e of expenses) {
    dayTotals.set(e.date, (dayTotals.get(e.date) ?? 0) + e.amountInr)
  }
  const dailySpend = [...dayTotals.entries()]
    .map(([date, amountInr]) => ({ date, amountInr }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Alerts
  const envelopeState = computeEnvelopes(budgets, expenses, currentMonth, categoryRows, groupNames)

  const alerts: string[] = []
  if (envelopeState.isOverAssigned) {
    alerts.push(`Over-assigned by ₹${Math.abs(envelopeState.readyToAssign)} — reduce category budgets.`)
  }
  const discretionaryPct = monthSpend > 0 ? (discretionarySpend / monthSpend) * 100 : 0
  if (discretionaryPct > 60) {
    alerts.push('Discretionary share above 60%; trigger cooling rule for non-essential purchases this week.')
  }

  return {
    meta: {
      generatedAt: now.toISOString(),
      month: currentMonth,
      monthlySpendCapInr: 45000,
      dailySoftCapInr: 1500,
    },
    totals: {
      monthSpendInr: monthSpend,
      essentialSpendInr: essentialSpend,
      discretionarySpendInr: discretionarySpend,
      duesReceivableInr: 0,
    },
    topCategories,
    dailySpend,
    expenseRows: expenses.map((e) => ({
      timestamp: e.timestamp,
      date: e.date,
      item: e.item,
      amountInr: e.amountInr,
      category: e.category,
    })),
    envelopeState,
    alerts,
    deepLinks: [
      { label: 'Open Expense Dashboard', url: '../../expense-dashboard/' },
      { label: 'Expenses CSV', url: '../../productivity/expenses.csv' },
      { label: 'Subscriptions CSV', url: '../../productivity/subscriptions.csv' },
    ],
    subscriptions: subscriptions.map((s) => ({
      timestamp: s.timestamp,
      service: s.service,
      amountInr: s.amountInr,
      billingCycle: s.billingCycle,
      nextDueDate: s.nextDueDate,
      status: s.status,
      renewalOrEndMonth: s.renewalOrEndMonth,
      notes: s.notes,
      category: s.category,
    })),
  }
}
