import { getCollection } from '@/lib/http'
import { EXPENSE_HEADERS, toRow } from '@/lib/models'
import type { Auth } from '@/lib/access'
import { cachedRead } from '@/lib/cache'
import { computeWrapped, type WrappedData } from '@/src/services/wrappedAdapter'

/** Minimum logged expenses in a month before its Wrapped edition unlocks. */
export const WRAPPED_MIN_TRANSACTIONS = 10

/** The one edition currently available: the previous completed calendar month, IST. 'YYYY-MM'. */
export function currentEdition(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const prevMonth = m === 1 ? 12 : m - 1
  const prevYear = m === 1 ? y - 1 : y
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`
}

/** Inclusive 'YYYY-MM-DD' start/end for a 'YYYY-MM' month. */
export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/** Transaction count + availability for a month's edition, without computing the full recap. */
export async function editionStatus(
  auth: Auth,
  month: string,
): Promise<{ month: string; transactionCount: number; available: boolean; minTransactions: number }> {
  const { start, end } = monthRange(month)
  const coll = await getCollection('expenses', auth)
  const docs = await coll.find({ date: { $gte: start, $lte: end } }).toArray()
  const rows = docs.map((d) => toRow(EXPENSE_HEADERS, d))
  const transactionCount = rows.filter((r) => Number(r.amount_inr) > 0).length
  return {
    month,
    transactionCount,
    available: transactionCount >= WRAPPED_MIN_TRANSACTIONS,
    minTransactions: WRAPPED_MIN_TRANSACTIONS,
  }
}

/**
 * The month's computed recap, cached per user-month. Shared by `/api/wrapped`
 * and the judgement route so a judgement request costs no extra Mongo read
 * once the recap is warm.
 */
export function readRecap(auth: Auth, month: string): Promise<WrappedData> {
  const { start, end } = monthRange(month)
  return cachedRead(
    'wrapped',
    auth.userId,
    async () => {
      const coll = await getCollection('expenses', auth)
      const docs = await coll.find({ date: { $gte: start, $lte: end } }).toArray()
      return computeWrapped(docs.map((d) => toRow(EXPENSE_HEADERS, d)), month)
    },
    month,
  )
}
