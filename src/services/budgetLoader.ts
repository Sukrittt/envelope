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

export function computeEnvelopes(
  budgets: BudgetRow[],
  expenses: Array<{ date: string; amountInr: number; category: string }>,
  currentMonth: string,
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
  const categorySet = new Set<string>()

  for (const b of monthBudgets) {
    if (b.category !== '__income__') categorySet.add(b.category)
  }
  for (const cat of monthSpending.keys()) {
    categorySet.add(cat)
  }

  const envelopes: Envelope[] = []
  let totalAssigned = 0
  let totalSpent = 0

  for (const category of categorySet) {
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

    const assigned = curr?.assigned ?? 0
    const rolledOver = curr?.rolledOver ?? 0
    const computedRollover = prev
      ? prev.assigned + prev.rolledOver - prevSpent
      : rolledOver

    const spent = monthSpending.get(category) ?? 0
    const available = assigned + computedRollover - spent

    totalAssigned += assigned
    totalSpent += spent

    envelopes.push({
      category,
      assigned,
      spent,
      available,
      rolledOver: computedRollover,
      isOverspent: available < 0,
      spentPct: assigned > 0 ? Math.min(100, (spent / assigned) * 100) : spent > 0 ? 100 : 0,
    })
  }

  envelopes.sort((a, b) => {
    if (a.isOverspent !== b.isOverspent) return a.isOverspent ? -1 : 1
    return a.category.localeCompare(b.category)
  })

  const readyToAssign = income - totalAssigned

  return {
    month: currentMonth,
    income,
    totalAssigned,
    totalSpent,
    readyToAssign,
    envelopes,
    isOverAssigned: readyToAssign < 0,
  }
}

export async function loadBudgetState(
  expenses: Array<{ date: string; amountInr: number; category: string }>,
  currentMonth: string,
): Promise<EnvelopeState> {
  let budgets: BudgetRow[] = []

  try {
    const resp = await fetch('/productivity/budgets.csv')
    if (resp.ok) {
      const text = await resp.text()
      budgets = parseBudgetCSV(text)
    }
  } catch {
    // budgets file not found — proceed with empty budgets
  }

  return computeEnvelopes(budgets, expenses, currentMonth)
}
