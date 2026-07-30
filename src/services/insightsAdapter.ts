import { getExpenses, getSubscriptions } from './api'

export interface ExpenseRow {
  date: string
  item: string
  amountInr: number
  category: string
}

export interface SubscriptionRow {
  service: string
  amountInr: number
  billingCycle: string
  status: string
  renewalOrEndMonth: string
}

export interface CategoryMonthlyAvg {
  category: string
  avgMonthly: number
  color: string
}

export interface CategoryTrend {
  category: string
  months: Array<{ month: string; total: number }>
  changePct: number | null
}

export interface MonthProjection {
  currentSpend: number
  projectedTotal: number
  adjustedProjectedTotal: number
  cap: number
  daysElapsed: number
  daysRemaining: number
  daysLogged: number
  dailyRunRate: number
  safeDailyBudget: number
  confidence: 'Low' | 'Medium' | 'High'
}

export interface SubscriptionBurn {
  totalMonthly: number
  capPct: number
  subscriptions: SubscriptionRow[]
}

export interface SpendingPatterns {
  topDays: Array<{ day: string; avgSpend: number }>
  essentialTotal: number
  discretionaryTotal: number
  essentialPct: number
}

export interface CategoryBudgetLensRow {
  category: string
  avg3m: number
  currentMonth: number
  gapAmount: number
  gapPct: number | null
  suggestedBudget: number
  forecastMonthEnd: number
  recommendedCap: number
  status: 'Under' | 'Watch' | 'Over'
}

export interface FixedVariableSplit {
  type: 'Fixed' | 'Variable'
  currentMonth: number
  avg3m: number
}

export interface InsightsData {
  avgByCategory: CategoryMonthlyAvg[]
  categoryTrends: CategoryTrend[]
  projection: MonthProjection
  subscriptionBurn: SubscriptionBurn
  patterns: SpendingPatterns
  categoryBudgetLens: CategoryBudgetLensRow[]
  fixedVariable: FixedVariableSplit[]
  insightChips: string[]
}

const CATEGORY_COLORS = ['#7aa2ff', '#4fd1c5', '#f59e8b', '#b794f4', '#f6c453', '#63b3ed', '#f472b6', '#34d399']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ESSENTIAL_CATEGORIES = new Set(['Bills', 'Food', 'Travel', 'Personal care'])
const PRIORITY_CATEGORIES = ['Food', 'Travel', 'Football', 'Bills', 'Subscriptions', 'Shopping', 'Personal care', 'Betting']
const EXCEPTIONAL_KEYWORDS = ['goa', 'betting', 'refund']
const RECURRING_SUBSCRIPTION_HINTS = ['netflix', 'spotify', 'prime', 'openai', '11labs', 'whisper', 'subscription']

function normalizeCategory(category: string): string {
  const clean = category.trim()
  if (/^subscription$/i.test(clean)) return 'Subscriptions'
  return clean
}

function isExceptional(item: string): boolean {
  const lower = item.toLowerCase()
  return EXCEPTIONAL_KEYWORDS.some((k) => lower.includes(k))
}

function isFixedExpense(row: ExpenseRow): boolean {
  const category = normalizeCategory(row.category).toLowerCase()
  if (category.includes('bill') || category.includes('subscription')) return true
  const item = row.item.toLowerCase()
  return RECURRING_SUBSCRIPTION_HINTS.some((hint) => item.includes(hint))
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function loadInsightsData(cap: number): Promise<InsightsData> {
  const [apiExpenses, apiSubs] = await Promise.all([
    getExpenses().catch(() => []),
    getSubscriptions().catch(() => []),
  ])

  const expenses: ExpenseRow[] = apiExpenses.map((r) => ({
    date: r.date,
    item: r.item,
    amountInr: Number(r.amount_inr) || 0,
    category: r.category,
  }))
  const subscriptions: SubscriptionRow[] = apiSubs.map((r) => ({
    service: r.service,
    amountInr: Number(r.amount_inr) || 0,
    billingCycle: r.billing_cycle,
    status: r.status,
    renewalOrEndMonth: r.renewal_or_end_month,
  }))

  return computeInsights(expenses, subscriptions, cap)
}

function computeInsights(expenses: ExpenseRow[], subscriptions: SubscriptionRow[], cap: number): InsightsData {
  const datedRows = expenses
    .map((e) => ({ ...e, category: normalizeCategory(e.category), parsedDate: new Date(e.date) }))
    .filter((e) => !Number.isNaN(e.parsedDate.getTime()))
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())

  const latest = datedRows[datedRows.length - 1]?.parsedDate ?? new Date()
  const currentMonth = monthKeyFromDate(latest)

  const monthCat = new Map<string, Map<string, number>>()
  const monthTotals = new Map<string, number>()
  for (const e of datedRows) {
    const month = e.date.slice(0, 7)
    if (!monthCat.has(month)) monthCat.set(month, new Map())
    const catMap = monthCat.get(month)!
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amountInr)
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + e.amountInr)
  }

  const months = [...monthCat.keys()].sort()
  const recentMonths = months.slice(-3)
  const monthCount3m = Math.max(1, recentMonths.length)

  const allCategories = new Set<string>()
  for (const catMap of monthCat.values()) {
    for (const cat of catMap.keys()) allCategories.add(cat)
  }

  const categoryTotals = new Map<string, number>()
  for (const catMap of monthCat.values()) {
    for (const [cat, amount] of catMap) {
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + amount)
    }
  }

  const numMonths = Math.max(1, months.length)
  const avgByCategory: CategoryMonthlyAvg[] = [...categoryTotals.entries()]
    .map(([category, total], i) => ({
      category,
      avgMonthly: total / numMonths,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
    .sort((a, b) => b.avgMonthly - a.avgMonthly)

  const categoryTrends: CategoryTrend[] = [...allCategories]
    .map((category) => {
      const monthlyData = recentMonths.map((month) => ({
        month,
        total: monthCat.get(month)?.get(category) ?? 0,
      }))
      const nonZero = monthlyData.filter((m) => m.total > 0)
      let changePct: number | null = null
      if (nonZero.length >= 2) {
        const prev = nonZero[nonZero.length - 2].total
        const curr = nonZero[nonZero.length - 1].total
        if (prev > 0) changePct = ((curr - prev) / prev) * 100
      }
      return { category, months: monthlyData, changePct }
    })
    .filter((t) => t.months.some((m) => m.total > 0))
    .sort((a, b) => {
      const aLast = a.months[a.months.length - 1]?.total ?? 0
      const bLast = b.months[b.months.length - 1]?.total ?? 0
      return bLast - aLast
    })

  const currentMonthExpenses = datedRows.filter((e) => e.date.startsWith(currentMonth))
  const currentSpend = currentMonthExpenses.reduce((s, e) => s + e.amountInr, 0)

  const currentDate = latest.getDate()
  const daysInMonth = new Date(latest.getFullYear(), latest.getMonth() + 1, 0).getDate()
  const daysElapsed = Math.max(1, currentDate)
  const daysRemaining = Math.max(0, daysInMonth - currentDate)
  const daysLogged = new Set(currentMonthExpenses.map((e) => e.date)).size

  const dailyRunRate = currentSpend / daysElapsed
  const projectedTotal = currentSpend + dailyRunRate * daysRemaining

  const adjustedSpendBase = currentMonthExpenses.reduce((sum, e) => {
    if (e.amountInr < 0) return sum + e.amountInr
    return isExceptional(e.item) ? sum : sum + e.amountInr
  }, 0)
  const adjustedDailyRunRate = adjustedSpendBase / daysElapsed
  const adjustedProjectedTotal = adjustedSpendBase + adjustedDailyRunRate * daysRemaining

  const safeDailyBudget = daysRemaining > 0 ? Math.max(0, cap - currentSpend) / daysRemaining : 0
  const confidence: 'Low' | 'Medium' | 'High' = daysLogged < 5 ? 'Low' : daysLogged <= 10 ? 'Medium' : 'High'

  const projection: MonthProjection = {
    currentSpend,
    projectedTotal,
    adjustedProjectedTotal,
    cap,
    daysElapsed,
    daysRemaining,
    daysLogged,
    dailyRunRate,
    safeDailyBudget,
    confidence,
  }

  const activeSubs = subscriptions.filter((s) => /^active/i.test(s.status))
  const totalMonthly = activeSubs.reduce((s, sub) => {
    if (sub.billingCycle === 'yearly') return s + sub.amountInr / 12
    return s + sub.amountInr
  }, 0)

  const subscriptionBurn: SubscriptionBurn = {
    totalMonthly: Math.round(totalMonthly),
    capPct: cap > 0 ? Math.round((totalMonthly / cap) * 100) : 0,
    subscriptions,
  }

  const dayTotals = new Map<number, number[]>()
  for (const e of currentMonthExpenses) {
    const day = e.parsedDate.getDay()
    if (!dayTotals.has(day)) dayTotals.set(day, [])
    dayTotals.get(day)!.push(e.amountInr)
  }

  const topDays = [...dayTotals.entries()]
    .map(([day, amounts]) => ({
      day: DAY_NAMES[day],
      avgSpend: amounts.reduce((a, b) => a + b, 0) / amounts.length,
    }))
    .sort((a, b) => b.avgSpend - a.avgSpend)

  const essentialTotal = currentMonthExpenses
    .filter((e) => ESSENTIAL_CATEGORIES.has(e.category))
    .reduce((s, e) => s + e.amountInr, 0)
  const discretionaryTotal = currentSpend - essentialTotal

  const patterns: SpendingPatterns = {
    topDays,
    essentialTotal,
    discretionaryTotal,
    essentialPct: currentSpend > 0 ? Math.round((essentialTotal / currentSpend) * 100) : 0,
  }

  const avg3mByCategory = new Map<string, number>()
  for (const category of allCategories) {
    const total3m = recentMonths.reduce((sum, month) => sum + (monthCat.get(month)?.get(category) ?? 0), 0)
    avg3mByCategory.set(category, total3m / monthCount3m)
  }

  const categoriesOrdered = [
    ...PRIORITY_CATEGORIES.filter((cat) => allCategories.has(cat)),
    ...[...allCategories].filter((cat) => !PRIORITY_CATEGORIES.includes(cat)).sort((a, b) => a.localeCompare(b)),
  ]

  const categoryBudgetLens: CategoryBudgetLensRow[] = categoriesOrdered.map((category) => {
    const avg3m = avg3mByCategory.get(category) ?? 0
    const current = monthCat.get(currentMonth)?.get(category) ?? 0
    const gapAmount = current - avg3m
    const gapPct = avg3m > 0 ? (gapAmount / avg3m) * 100 : null
    const forecastMonthEnd = current + (current / daysElapsed) * daysRemaining
    const recommendedCap = Math.max(0, Math.round((avg3m * 1.1) / 10) * 10)
    const ratio = recommendedCap > 0 ? forecastMonthEnd / recommendedCap : 0
    const status: 'Under' | 'Watch' | 'Over' = ratio <= 0.9 ? 'Under' : ratio <= 1 ? 'Watch' : 'Over'

    return {
      category,
      avg3m,
      currentMonth: current,
      gapAmount,
      gapPct,
      suggestedBudget: recommendedCap,
      forecastMonthEnd,
      recommendedCap,
      status,
    }
  })

  const fixedVariableByMonth = recentMonths.map((month) => {
    const rows = datedRows.filter((r) => r.date.startsWith(month))
    const fixed = rows.filter(isFixedExpense).reduce((sum, r) => sum + r.amountInr, 0)
    const total = monthTotals.get(month) ?? 0
    return { fixed, variable: total - fixed }
  })

  const currentFixed = currentMonthExpenses.filter(isFixedExpense).reduce((sum, r) => sum + r.amountInr, 0)
  const currentVariable = currentSpend - currentFixed
  const fixedAvg3m = fixedVariableByMonth.reduce((sum, m) => sum + m.fixed, 0) / Math.max(1, fixedVariableByMonth.length)
  const variableAvg3m = fixedVariableByMonth.reduce((sum, m) => sum + m.variable, 0) / Math.max(1, fixedVariableByMonth.length)

  const fixedVariable: FixedVariableSplit[] = [
    { type: 'Fixed', currentMonth: currentFixed, avg3m: fixedAvg3m },
    { type: 'Variable', currentMonth: currentVariable, avg3m: variableAvg3m },
  ]

  const foodLens = categoryBudgetLens.find((r) => r.category === 'Food')
  const travelLens = categoryBudgetLens.find((r) => r.category === 'Travel')
  const safeSpendPerDayAdjusted = daysRemaining > 0 ? Math.max(0, cap - adjustedSpendBase) / daysRemaining : 0

  const insightChips = [
    `Food usual monthly need ~₹${Math.round(foodLens?.avg3m ?? 0).toLocaleString('en-IN')}`,
    `Travel trend ${travelLens?.gapPct && travelLens.gapPct > 0 ? '+' : ''}${Math.round(travelLens?.gapPct ?? 0)}% vs avg`,
    `Fixed monthly burden ~₹${Math.round(fixedAvg3m).toLocaleString('en-IN')}`,
    `Safe spend/day for rest of month ~₹${Math.round(safeSpendPerDayAdjusted).toLocaleString('en-IN')}`,
  ]

  return {
    avgByCategory,
    categoryTrends,
    projection,
    subscriptionBurn,
    patterns,
    categoryBudgetLens,
    fixedVariable,
    insightChips,
  }
}
