import type { BudgetRow, Envelope, EnvelopeState } from '../types/expense'

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

  const incomeRows = budgets.filter((b) => b.category === '__income__')
  // No income entered yet this month (no "start new month" flow exists) — carry
  // forward the most recent prior month's income until the user changes it.
  const incomeRow =
    incomeRows.find((b) => b.month === currentMonth) ??
    incomeRows.filter((b) => b.month < currentMonth).sort((a, b) => b.month.localeCompare(a.month))[0]
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

    const isCC = category === '__credit_card__'
    const assigned = curr?.assigned ?? 0
    // Clean slate every month: unspent money does not carry forward. Prior
    // months' own assigned/spent stay untouched in their own rows.
    const computedRollover = 0

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
