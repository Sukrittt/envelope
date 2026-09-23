import { apiFetch } from './client'

export interface WrappedData {
  month: string
  range: { startDate: string; endDate: string; daysTracked: number }
  totalSpent: number
  totalTransactions: number
  topCategories: { category: string; total: number; pct: number }[]
  biggestPurchase: { item: string; amountInr: number; category: string; date: string } | null
  topWeekday: { day: string; total: number; count: number } | null
  longestStreak: { days: number; startDate: string; endDate: string } | null
  longestGap: { days: number; startDate: string; endDate: string } | null
  weeklyTotals: { label: string; total: number }[]
}

/** Jev's read of the month, fetched apart from the recap. Null when Jev is unsure or unavailable. */
export interface WrappedJudgement {
  persona?: string | null
  treatCategory?: string | null
}

export interface WrappedStatus {
  month: string
  transactionCount: number
  available: boolean
  minTransactions: number
  /** In-progress calendar month tracked toward the next unlock. */
  currentMonth: string
  currentMonthCount: number
}

export async function getWrapped(month?: string): Promise<WrappedData> {
  const url = month ? `/api/wrapped?month=${month}` : '/api/wrapped'
  const resp = await apiFetch(url)
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to load wrapped: ${resp.status}`)
  }
  return resp.json()
}

export async function getWrappedStatus(): Promise<WrappedStatus> {
  const resp = await apiFetch('/api/wrapped/status')
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to load wrapped status: ${resp.status}`)
  }
  return resp.json()
}

/** Never throws: Wrapped renders from the recap alone, so a failure is simply no judgement. */
export async function getWrappedJudgement(month?: string): Promise<WrappedJudgement> {
  const url = month ? `/api/wrapped/judgement?month=${month}` : '/api/wrapped/judgement'
  const resp = await apiFetch(url).catch(() => null)
  if (!resp?.ok) return {}
  return resp.json().catch(() => ({}))
}
