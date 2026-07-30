import type { ExpensePanelContract } from './expensePanelAdapter'
import { computeEnvelopes } from './budgetLoader'
import type { BudgetRow } from '../types/expense'

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
  status: string
  renewalOrEndMonth: string
}

const ESSENTIAL_CATEGORIES = new Set(['Bills', 'Food', 'Travel', 'Personal care'])

function parseBudgetCSV(text: string): BudgetRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const iMonth = header.indexOf('month')
  const iCategory = header.indexOf('category')
  const iAssigned = header.indexOf('assigned')
  const iRolledOver = header.indexOf('rolled_over')

  const rows: BudgetRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const assigned = Number(cols[iAssigned])
    if (Number.isNaN(assigned)) continue
    rows.push({
      month: cols[iMonth] ?? '',
      category: cols[iCategory] ?? '',
      assigned,
      rolledOver: Number(cols[iRolledOver]) || 0,
    })
  }
  return rows
}

function parseExpenseCSV(text: string): ExpenseRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const iTimestamp = header.indexOf('timestamp')
  const iDate = header.indexOf('date')
  const iItem = header.indexOf('item')
  const iAmount = header.indexOf('amount_inr')
  const iCategory = header.indexOf('category')

  const rows: ExpenseRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const amountInr = Number(cols[iAmount])
    if (Number.isNaN(amountInr)) continue
    rows.push({
      timestamp: cols[iTimestamp] ?? '',
      date: cols[iDate] ?? '',
      item: cols[iItem] ?? '',
      amountInr,
      category: cols[iCategory] ?? '',
    })
  }
  return rows
}

function parseSubscriptionCSV(text: string): SubscriptionRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const iTimestamp = header.indexOf('timestamp')
  const iService = header.indexOf('service')
  const iAmount = header.indexOf('amount_inr')
  const iBilling = header.indexOf('billing_cycle')
  const iStatus = header.indexOf('status')
  const iRenewal = header.indexOf('renewal_or_end_month')

  const rows: SubscriptionRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const amountInr = Number(cols[iAmount])
    if (Number.isNaN(amountInr)) continue
    rows.push({
      timestamp: cols[iTimestamp] ?? '',
      service: cols[iService] ?? '',
      amountInr,
      billingCycle: cols[iBilling] ?? '',
      status: cols[iStatus] ?? '',
      renewalOrEndMonth: cols[iRenewal] ?? '',
    })
  }
  return rows
}

export async function loadExpensePanelContract(): Promise<ExpensePanelContract> {
  const [expenseText, subText, budgetText] = await Promise.all([
    fetch('/productivity/expenses.csv').then((r) => r.text()),
    fetch('/productivity/subscriptions.csv').then((r) => (r.ok ? r.text() : '')),
    fetch('/productivity/budgets.csv').then((r) => (r.ok ? r.text() : '')),
  ])

  const expenses = parseExpenseCSV(expenseText)
  const subscriptions = parseSubscriptionCSV(subText)
  const budgets = budgetText ? parseBudgetCSV(budgetText) : []

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
  const envelopeState = computeEnvelopes(budgets, expenses, currentMonth)

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
      status: s.status,
      renewalOrEndMonth: s.renewalOrEndMonth,
    })),
  }
}
