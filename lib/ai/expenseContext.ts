import { computeEnvelopes } from '@/src/services/budgetLoader'
import { getCollection, nowIST } from '@/lib/http'
import type { Auth } from '@/lib/access'
import type { BudgetRow, Envelope } from '@/src/types/expense'

/**
 * Builds the plain-text "FACTS" context fed to the money-brain Gemini
 * prompts (brief + chat). Kept as plain text rather than JSON — cheaper in
 * tokens for the same information.
 */

const SENTINEL_INCOME = '__income__'
const SENTINEL_CREDIT_CARD = '__credit_card__'
const TXN_HISTORY_DAYS = 90
const TXN_CAP = 400
const TREND_MONTHS = 6

export interface ExpenseRow {
  timestamp?: string
  date: string
  item?: string
  amount_inr: number
  category: string
  notes?: string
  payment_method?: string
}

export interface BudgetDocRow {
  month: string
  category: string
  assigned: number
  rolled_over: number
}

export interface CategoryDocRow {
  name: string
  group?: string
  alertPcts?: number[]
}

export interface GroupDocRow {
  name: string
}

export interface SubscriptionDocRow {
  service: string
  amount_inr: number
  billing_cycle?: string
  next_due_date?: string
  renewal_or_end_month?: string
  timestamp?: string
  status?: string
}

export interface HoldingDocRow {
  name: string
  type?: string
  value: number
  updated_at?: string
}

export interface SummarizeExpensesInput {
  expenses: ExpenseRow[]
  budgets: BudgetDocRow[]
  categories: CategoryDocRow[]
  groups: GroupDocRow[]
  subscriptions: SubscriptionDocRow[]
  holdings: HoldingDocRow[]
  currentMonth: string // 'YYYY-MM'
  today: string // 'YYYY-MM-DD'
}

export interface SummarizeExpensesMeta {
  txnCountThisMonth: number
  totalSpent: number
  totalAssigned: number
  daysLeft: number
  daysElapsed: number
  totalDaysInMonth: number
}

export interface SummarizeExpensesResult {
  facts: string
  meta: SummarizeExpensesMeta
  envelopes: Envelope[]
  subscriptions: SubscriptionDocRow[]
  categories: CategoryDocRow[]
}

function round(n: number): number {
  return Math.round(n) || 0
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

/** Last `n` months (inclusive of `currentMonth`), oldest first, as 'YYYY-MM'. */
function lastNMonths(currentMonth: string, n: number): string[] {
  const [y, m] = currentMonth.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** How many months a billing cycle spans, for converting to a monthly-equivalent amount. */
function cycleMonths(cycle?: string): number {
  switch ((cycle ?? '').toLowerCase()) {
    case 'weekly':
      return 12 / 52
    case 'biweekly':
      return 12 / 26
    case 'quarterly':
      return 3
    case 'half-yearly':
    case 'semi-annual':
    case 'halfyearly':
      return 6
    case 'yearly':
    case 'annual':
    case 'annually':
      return 12
    case 'monthly':
    default:
      return 1
  }
}

export function summarizeExpenses(input: SummarizeExpensesInput): SummarizeExpensesResult {
  const { expenses, budgets, categories, groups, subscriptions, holdings, currentMonth, today } = input

  const [cy, cm] = currentMonth.split('-').map(Number)
  const totalDaysInMonth = daysInMonth(cy, cm)
  const daysElapsed = Math.min(Number(today.split('-')[2]) || 0, totalDaysInMonth)
  const daysLeft = Math.max(0, totalDaysInMonth - daysElapsed)

  // --- Envelope math (real categories only; sentinels handled separately below) ---
  const realCategories = categories
    .filter((c) => c.name !== SENTINEL_INCOME && c.name !== SENTINEL_CREDIT_CARD)
    .map((c) => ({ name: c.name, group: c.group ?? '' }))

  const budgetRows: BudgetRow[] = budgets.map((b) => ({
    month: b.month,
    category: b.category,
    assigned: Number(b.assigned) || 0,
    rolledOver: Number(b.rolled_over) || 0,
  }))

  const envelopeExpenseRows = expenses.map((e) => ({
    date: e.date,
    amountInr: Number(e.amount_inr) || 0,
    category: e.category,
  }))

  const groupNames = groups.map((g) => g.name)

  const envelopeState = computeEnvelopes(budgetRows, envelopeExpenseRows, currentMonth, realCategories, groupNames)

  const income = envelopeState.income
  const ccEnvelope = envelopeState.envelopes.find((e) => e.isCreditCardPayment)

  // --- This month's transactions ---
  const monthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth))
  const realMonthExpenses = monthExpenses.filter(
    (e) => e.category !== SENTINEL_INCOME && e.category !== SENTINEL_CREDIT_CARD,
  )

  const lines: string[] = []

  lines.push(`MONTH: ${currentMonth} (day ${daysElapsed} of ${totalDaysInMonth}, ${daysLeft} days left)`)
  lines.push('')
  lines.push(`INCOME: ${round(income)}`)
  if (ccEnvelope) {
    lines.push(
      `CREDIT CARD: assigned ${round(ccEnvelope.assigned)}, charged ${round(ccEnvelope.spent)} this month, available ${round(ccEnvelope.available)}`,
    )
  } else {
    lines.push('CREDIT CARD: no activity')
  }
  lines.push('')

  lines.push('ENVELOPES (category|group|assigned|spent|available|overspent):')
  for (const e of envelopeState.envelopes) {
    if (e.isCreditCardPayment) continue // reported separately above, not a spending envelope
    lines.push(
      `${e.category}|${e.group ?? ''}|${round(e.assigned)}|${round(e.spent)}|${round(e.available)}|${e.isOverspent ? 'yes' : 'no'}`,
    )
  }
  lines.push('')

  // Trend: per-category totals for each of the last TREND_MONTHS months.
  const trendMonths = lastNMonths(currentMonth, TREND_MONTHS)
  const trendSet = new Set(trendMonths)
  const trendCategoryTotals = new Map<string, Map<string, number>>()
  for (const e of expenses) {
    if (e.category === SENTINEL_INCOME || e.category === SENTINEL_CREDIT_CARD) continue
    const month = e.date.slice(0, 7)
    if (!trendSet.has(month)) continue
    const catMap = trendCategoryTotals.get(e.category) ?? new Map<string, number>()
    catMap.set(month, (catMap.get(month) ?? 0) + (Number(e.amount_inr) || 0))
    trendCategoryTotals.set(e.category, catMap)
  }
  lines.push(`TREND (category totals by month, last ${TREND_MONTHS} months):`)
  lines.push(`category|${trendMonths.join('|')}`)
  for (const [category, monthMap] of [...trendCategoryTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const totals = trendMonths.map((m) => round(monthMap.get(m) ?? 0))
    if (totals.every((v) => v === 0)) continue
    lines.push(`${category}|${totals.join('|')}`)
  }
  lines.push('')

  // Top 10 items this month by amount.
  const top10 = [...realMonthExpenses].sort((a, b) => (Number(b.amount_inr) || 0) - (Number(a.amount_inr) || 0)).slice(0, 10)
  lines.push('TOP 10 ITEMS THIS MONTH (date|item|amount|category):')
  for (const e of top10) {
    lines.push(`${e.date}|${e.item ?? ''}|${round(Number(e.amount_inr) || 0)}|${e.category}`)
  }
  lines.push('')

  // Subscriptions with computed monthly burn.
  lines.push('SUBSCRIPTIONS (service|billing_cycle|amount|monthly_burn|status):')
  let totalMonthlyBurn = 0
  for (const s of subscriptions) {
    const amount = Number(s.amount_inr) || 0
    const monthlyBurn = amount / cycleMonths(s.billing_cycle)
    const status = s.status ?? ''
    const isActive = !['cancelled', 'canceled', 'ended', 'paused'].includes(status.toLowerCase())
    if (isActive) totalMonthlyBurn += monthlyBurn
    lines.push(`${s.service}|${s.billing_cycle ?? ''}|${round(amount)}|${round(monthlyBurn)}|${status || 'active'}`)
  }
  lines.push(`Total active monthly burn: ${round(totalMonthlyBurn)}`)
  lines.push('')

  // Investment holdings snapshot (not spending — reported separately from envelopes).
  lines.push('INVESTMENTS (name|type|value|updated_at):')
  let totalInvestmentValue = 0
  for (const h of holdings) {
    const value = round(Number(h.value) || 0)
    totalInvestmentValue += value
    lines.push(`${h.name}|${h.type ?? ''}|${value}|${h.updated_at ?? ''}`)
  }
  lines.push(`Total investment value: ${round(totalInvestmentValue)}`)
  lines.push('')

  // Last TXN_HISTORY_DAYS days of raw transactions, newest first, capped at TXN_CAP.
  const cutoff = new Date(`${today}T00:00:00`)
  cutoff.setDate(cutoff.getDate() - TXN_HISTORY_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recentTxns = expenses
    .filter((e) => e.date >= cutoffStr && e.date <= today)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
    })
    .slice(0, TXN_CAP)
  lines.push(
    `TRANSACTIONS (last ${TXN_HISTORY_DAYS} days, newest first, capped at ${TXN_CAP}; date|item|amount|category|payment_method):`,
  )
  for (const e of recentTxns) {
    lines.push(`${e.date}|${e.item ?? ''}|${round(Number(e.amount_inr) || 0)}|${e.category}|${e.payment_method ?? ''}`)
  }

  const facts = lines.join('\n')

  return {
    facts,
    meta: {
      txnCountThisMonth: monthExpenses.length,
      totalSpent: round(envelopeState.totalSpent),
      totalAssigned: round(envelopeState.totalAssigned),
      daysLeft,
      daysElapsed,
      totalDaysInMonth,
    },
    envelopes: envelopeState.envelopes,
    subscriptions,
    categories,
  }
}

/** Fetches all collections needed for the money-brain context and builds `facts`. */
export async function buildExpenseContext(auth: Auth): Promise<SummarizeExpensesResult> {
  const [expensesColl, budgetsColl, categoriesColl, groupsColl, subscriptionsColl, holdingsColl] = await Promise.all([
    getCollection('expenses', auth),
    getCollection('budgets', auth),
    getCollection('categories', auth),
    getCollection('groups', auth),
    getCollection('subscriptions', auth),
    getCollection('holdings', auth),
  ])

  const [expenseDocs, budgetDocs, categoryDocs, groupDocs, subscriptionDocs, holdingDocs] = await Promise.all([
    expensesColl.find({}).toArray(),
    budgetsColl.find({}).toArray(),
    categoriesColl.find({}).toArray(),
    groupsColl.find({}).toArray(),
    subscriptionsColl.find({}).toArray(),
    holdingsColl.find({}).toArray(),
  ])

  const expenses: ExpenseRow[] = expenseDocs.map((d) => ({
    timestamp: d.timestamp ? String(d.timestamp) : undefined,
    date: String(d.date ?? ''),
    item: d.item ? String(d.item) : d.description ? String(d.description) : '',
    amount_inr: Number(d.amount_inr ?? d.amount) || 0,
    category: String(d.category ?? ''),
    notes: d.notes ? String(d.notes) : undefined,
    payment_method: d.payment_method ? String(d.payment_method) : undefined,
  }))

  const budgets: BudgetDocRow[] = budgetDocs.map((d) => ({
    month: String(d.month ?? ''),
    category: String(d.category ?? ''),
    assigned: Number(d.assigned) || 0,
    rolled_over: Number(d.rolled_over) || 0,
  }))

  const categories: CategoryDocRow[] = categoryDocs
    .map((d) => ({
      name: String(d.name ?? ''),
      group: d.group ? String(d.group) : '',
      alertPcts: Array.isArray(d.alertPcts) ? d.alertPcts.filter((v): v is number => typeof v === 'number') : undefined,
    }))
    .filter((c) => c.name)

  const groups: GroupDocRow[] = groupDocs.map((d) => ({ name: String(d.name ?? '') })).filter((g) => g.name)

  const subscriptions: SubscriptionDocRow[] = subscriptionDocs.map((d) => ({
    service: String(d.service ?? ''),
    amount_inr: Number(d.amount_inr) || 0,
    billing_cycle: d.billing_cycle ? String(d.billing_cycle) : undefined,
    next_due_date: d.next_due_date ? String(d.next_due_date) : undefined,
    renewal_or_end_month: d.renewal_or_end_month ? String(d.renewal_or_end_month) : undefined,
    timestamp: d.timestamp ? String(d.timestamp) : undefined,
    status: d.status ? String(d.status) : undefined,
  }))

  const holdings: HoldingDocRow[] = holdingDocs.map((d) => ({
    name: String(d.name ?? ''),
    type: d.type ? String(d.type) : undefined,
    value: Number(d.value) || 0,
    updated_at: d.updated_at ? String(d.updated_at) : undefined,
  }))

  const { date: today } = nowIST()
  const currentMonth = today.slice(0, 7)

  return summarizeExpenses({ expenses, budgets, categories, groups, subscriptions, holdings, currentMonth, today })
}
