import type { BudgetRow, Envelope, EnvelopeState } from '../types/expense'

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

function getMonthSpendingByCategory(
  expenses: Array<{ date: string; amountInr: number; category: string }>,
  month: string,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of expenses) {
    if (!e.date.startsWith(month)) continue
    map.set(e.category, (map.get(e.category) ?? 0) + e.amountInr)
  }
  return map
}

function getLastSpentByCategory(
  expenses: Array<{ date: string; amountInr: number; category: string }>,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const e of expenses) {
    if (!e.date) continue
    const current = map.get(e.category)
    if (!current || e.date > current) map.set(e.category, e.date)
  }
  return map
}

export function computeEnvelopes(
  budgets: BudgetRow[],
  expenses: Array<{ date: string; amountInr: number; category: string }>,
  currentMonth: string,
  categories: Array<{ name: string; group: string }>,
  groups: string[],
): EnvelopeState {
  const monthBudgets = budgets.filter((b) => b.month === currentMonth)
  const prevMonthBudgets = budgets.filter((b) => b.month < currentMonth)

  const prevMonthMap = new Map<string, BudgetRow[]>()
  for (const b of prevMonthBudgets) {
    const arr = prevMonthMap.get(b.category) ?? []
    arr.push(b)
    prevMonthMap.set(b.category, arr)
  }

  const incomeRow = monthBudgets.find((b) => b.category === '__income__')
  const income = incomeRow?.assigned ?? 0

  const monthSpending = getMonthSpendingByCategory(expenses, currentMonth)
  const lastSpentByCat = getLastSpentByCategory(expenses)

  const categoryGroup = new Map<string, string>()
  for (const c of categories) categoryGroup.set(c.name, c.group ?? '')

  const budgetCategories = new Set(
    [...monthBudgets, ...prevMonthBudgets]
      .filter((b) => b.category !== '__income__')
      .map((b) => b.category),
  )

  const allCategories = [...new Set([...categories.map((c) => c.name), ...budgetCategories])]

  const envelopes: Envelope[] = []
  let totalAssigned = 0
  let totalSpent = 0

  for (const category of allCategories) {
    const curr = monthBudgets.find((b) => b.category === category)
    const prevMonths = prevMonthMap.get(category) ?? []
    const prevSorted = prevMonths.sort((a, b) => b.month.localeCompare(a.month))
    const prev = prevSorted[0]

    let prevSpent = 0
    if (prev) {
      const prevExpenses = expenses.filter(
        (e) => e.date.startsWith(prev.month) && e.category === category,
      )
      prevSpent = prevExpenses.reduce((s, e) => s + e.amountInr, 0)
    }

    const isCC = category === '__credit_card__'
    const assigned = curr?.assigned ?? 0
    const rolledOver = curr?.rolledOver ?? 0
    const computedRollover = prev
      ? Math.max(0, prev.assigned + prev.rolledOver - prevSpent)
      : rolledOver

    const spent = monthSpending.get(category) ?? 0
    const available = assigned + computedRollover - spent

    if (!isCC) {
      totalAssigned += assigned
      totalSpent += spent
    }

    envelopes.push({
      category,
      group: isCC ? '' : (categoryGroup.get(category) ?? ''),
      assigned,
      spent,
      available,
      rolledOver: computedRollover,
      isOverspent: available < 0,
      spentPct: assigned > 0 ? Math.min(100, (spent / assigned) * 100) : spent > 0 ? 100 : 0,
      isCreditCardPayment: isCC,
      lastSpentDate: lastSpentByCat.get(category),
    })
  }

  envelopes.sort((a, b) => {
    if (a.isOverspent !== b.isOverspent) return a.isOverspent ? -1 : 1
    return a.category.localeCompare(b.category)
  })

  const readyToAssign = Math.round(income - totalAssigned) || 0

  return {
    month: currentMonth,
    income,
    totalAssigned,
    totalSpent,
    readyToAssign,
    envelopes,
    isOverAssigned: readyToAssign < 0,
    groups: groups.filter((g) => envelopes.some((e) => e.group === g)),
  }
}

export async function loadBudgetState(
  expenses: Array<{ date: string; amountInr: number; category: string }>,
  currentMonth: string,
  categories: Array<{ name: string; group: string }>,
  groups: string[],
): Promise<EnvelopeState> {
  let budgets: BudgetRow[] = []

  try {
    const resp = await fetch('/productivity/budgets.csv')
    if (resp.ok) {
      const text = await resp.text()
      budgets = parseBudgetCSV(text)
    }
  } catch {
  }

  return computeEnvelopes(budgets, expenses, currentMonth, categories, groups)
}
