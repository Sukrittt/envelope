import { getExpenses } from '@/src/api/expenses'

/** The activity list's view shape, mapped from the wire rows. */
export interface Transaction {
  id: string
  timestamp: string
  date: string
  item: string
  amountInr: number
  category: string
  notes: string
  source: string
}

export async function loadTransactions(): Promise<Transaction[]> {
  const rows = await getExpenses()
  return rows.map((r) => ({
    id: r.id ?? '',
    timestamp: r.timestamp ?? '',
    date: r.date ?? '',
    item: r.item ?? '',
    amountInr: Number(r.amount_inr) || 0,
    category: r.category ?? '',
    notes: r.notes ?? '',
    source: r.source ?? '',
  }))
}