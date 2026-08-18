import type { Row } from '@/lib/models'

export interface WrappedData {
  range: { startDate: string; endDate: string; daysTracked: number }
  totalSpent: number
  totalTransactions: number
  topCategories: Array<{ category: string; total: number; pct: number }>
  biggestPurchase: { item: string; amountInr: number; category: string; date: string } | null
  topWeekday: { day: string; total: number; count: number } | null
  longestStreak: { days: number; startDate: string; endDate: string } | null
  longestGap: { days: number; startDate: string; endDate: string } | null
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const EMPTY_WRAPPED: WrappedData = {
  range: { startDate: '', endDate: '', daysTracked: 0 },
  totalSpent: 0,
  totalTransactions: 0,
  topCategories: [],
  biggestPurchase: null,
  topWeekday: null,
  longestStreak: null,
  longestGap: null,
}

/** Compute the all-time "Wrapped" recap from raw expense docs (real spend only, refunds excluded). */
export function computeWrapped(docs: Row[]): WrappedData {
  const rows = docs
    .map((r) => ({
      date: r.date,
      item: r.item,
      category: r.category,
      amountInr: Number(r.amount_inr) || 0,
      parsedDate: new Date(r.date),
    }))
    .filter((r) => !Number.isNaN(r.parsedDate.getTime()) && r.amountInr > 0)
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())

  if (rows.length === 0) return EMPTY_WRAPPED

  const distinctDates = [...new Set(rows.map((r) => r.date))].sort()
  const startDate = distinctDates[0]
  const endDate = distinctDates[distinctDates.length - 1]

  const totalSpent = rows.reduce((s, r) => s + r.amountInr, 0)

  const categoryTotals = new Map<string, number>()
  for (const r of rows) {
    categoryTotals.set(r.category, (categoryTotals.get(r.category) ?? 0) + r.amountInr)
  }
  const topCategories = [...categoryTotals.entries()]
    .map(([category, total]) => ({ category, total, pct: totalSpent > 0 ? (total / totalSpent) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const biggest = rows.reduce((max, r) => (r.amountInr > max.amountInr ? r : max), rows[0])
  const biggestPurchase = {
    item: biggest.item,
    amountInr: biggest.amountInr,
    category: biggest.category,
    date: biggest.date,
  }

  const weekdayTotals = new Map<number, { total: number; count: number }>()
  for (const r of rows) {
    const day = r.parsedDate.getDay()
    const entry = weekdayTotals.get(day) ?? { total: 0, count: 0 }
    entry.total += r.amountInr
    entry.count += 1
    weekdayTotals.set(day, entry)
  }
  const topWeekdayEntry = [...weekdayTotals.entries()].sort((a, b) => b[1].total - a[1].total)[0]
  const topWeekday = topWeekdayEntry
    ? { day: DAY_NAMES[topWeekdayEntry[0]], total: topWeekdayEntry[1].total, count: topWeekdayEntry[1].count }
    : null

  const MS_PER_DAY = 24 * 60 * 60 * 1000
  let longestStreak: WrappedData['longestStreak'] = null
  let longestGap: WrappedData['longestGap'] = null
  let streakStart = distinctDates[0]
  let prevDate = distinctDates[0]
  for (let i = 1; i <= distinctDates.length; i++) {
    const current = distinctDates[i]
    const gapDays = current
      ? Math.round((new Date(current).getTime() - new Date(prevDate).getTime()) / MS_PER_DAY)
      : null

    if (current && gapDays === 1) {
      prevDate = current
      continue
    }

    const streakDays = Math.round((new Date(prevDate).getTime() - new Date(streakStart).getTime()) / MS_PER_DAY) + 1
    if (!longestStreak || streakDays > longestStreak.days) {
      longestStreak = { days: streakDays, startDate: streakStart, endDate: prevDate }
    }
    if (current) {
      if (!longestGap || gapDays! > longestGap.days) {
        longestGap = { days: gapDays!, startDate: prevDate, endDate: current }
      }
      streakStart = current
      prevDate = current
    }
  }

  return {
    range: { startDate, endDate, daysTracked: distinctDates.length },
    totalSpent,
    totalTransactions: rows.length,
    topCategories,
    biggestPurchase,
    topWeekday,
    longestStreak,
    longestGap,
  }
}
