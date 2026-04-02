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
  cap: number
  daysElapsed: number
  daysRemaining: number
  dailyRunRate: number
  safeDailyBudget: number
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

export interface InsightsData {
  avgByCategory: CategoryMonthlyAvg[]
  categoryTrends: CategoryTrend[]
  projection: MonthProjection
  subscriptionBurn: SubscriptionBurn
  patterns: SpendingPatterns
}

const CATEGORY_COLORS = ['#7aa2ff', '#4fd1c5', '#f59e8b', '#b794f4', '#f6c453', '#63b3ed', '#f472b6', '#34d399']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ESSENTIAL_CATEGORIES = new Set(['Bills', 'Food', 'Travel', 'Personal care'])

function parseExpenseCSV(text: string): ExpenseRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',')
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
      service: cols[iService] ?? '',
      amountInr,
      billingCycle: cols[iBilling] ?? '',
      status: cols[iStatus] ?? '',
      renewalOrEndMonth: cols[iRenewal] ?? '',
    })
  }
  return rows
}

export async function loadInsightsData(cap: number): Promise<InsightsData> {
  const [expenseText, subText] = await Promise.all([
    fetch('/productivity/expenses.csv').then((r) => r.text()),
    fetch('/productivity/subscriptions.csv').then((r) => r.ok ? r.text() : ''),
  ])

  const expenses = parseExpenseCSV(expenseText)
  const subscriptions = parseSubscriptionCSV(subText)

  return computeInsights(expenses, subscriptions, cap)
}

function computeInsights(expenses: ExpenseRow[], subscriptions: SubscriptionRow[], cap: number): InsightsData {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Group by month+category
  const monthCat = new Map<string, Map<string, number>>()
  for (const e of expenses) {
    const month = e.date.slice(0, 7)
    if (!monthCat.has(month)) monthCat.set(month, new Map())
    const catMap = monthCat.get(month)!
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amountInr)
  }

  const months = [...monthCat.keys()].sort()

  // All categories
  const allCategories = new Set<string>()
  for (const catMap of monthCat.values()) {
    for (const cat of catMap.keys()) allCategories.add(cat)
  }

  // Average monthly spend by category
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

  // Category trends (last 3 months)
  const recentMonths = months.slice(-3)
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

  // Projection
  const currentMonthExpenses = expenses.filter((e) => e.date.startsWith(currentMonth))
  const currentSpend = currentMonthExpenses.reduce((s, e) => s + e.amountInr, 0)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysRemaining = daysInMonth - daysElapsed
  const dailyRunRate = daysElapsed > 0 ? currentSpend / daysElapsed : 0
  const projectedTotal = currentSpend + dailyRunRate * daysRemaining
  const safeDailyBudget = daysRemaining > 0 ? Math.max(0, cap - currentSpend) / daysRemaining : 0

  const projection: MonthProjection = {
    currentSpend,
    projectedTotal,
    cap,
    daysElapsed,
    daysRemaining,
    dailyRunRate,
    safeDailyBudget,
  }

  // Subscription burn
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

  // Spending patterns
  const dayTotals = new Map<number, number[]>()
  for (const e of currentMonthExpenses) {
    const d = new Date(e.date)
    if (Number.isNaN(d.getTime())) continue
    const day = d.getDay()
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

  return { avgByCategory, categoryTrends, projection, subscriptionBurn, patterns }
}
