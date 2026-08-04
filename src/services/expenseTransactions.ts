import { apiFetch } from './api'

export interface Transaction {
  timestamp: string
  date: string
  item: string
  amountInr: number
  category: string
  notes: string
  source: string
}

export async function loadTransactions(): Promise<Transaction[]> {
  const resp = await apiFetch('/api/expenses')
  if (!resp.ok) throw new Error(`Failed to load expenses: ${resp.status}`)
  const data = await resp.json()
  if (!data.rows || !Array.isArray(data.rows)) return []
  return data.rows.map((r: Record<string, string>) => ({
    timestamp: r.timestamp ?? '',
    date: r.date ?? '',
    item: r.item ?? '',
    amountInr: Number(r.amount_inr) || 0,
    category: r.category ?? '',
    notes: r.notes ?? '',
    source: r.source ?? '',
  }))
}