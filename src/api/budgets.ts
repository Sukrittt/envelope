import { apiFetch } from './client'
import type { BudgetRow, CsvResponse } from '@/src/types'

export async function getBudgets(): Promise<BudgetRow[]> {
  const resp = await apiFetch('/api/budgets')
  if (!resp.ok) throw new Error(`Failed to load budgets: ${resp.status}`)
  const data: CsvResponse<BudgetRow> = await resp.json()
  return data.rows
}

export async function addBudget(
  row: Omit<BudgetRow, 'rolled_over'> & { rolled_over?: string },
): Promise<void> {
  const resp = await apiFetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, rolled_over: row.rolled_over ?? '0' }),
  })
  if (!resp.ok) throw new Error(`Failed to add budget: ${resp.status}`)
}

export async function updateBudget(
  month: string,
  category: string,
  updates: Partial<BudgetRow & { newCategory?: string }>,
): Promise<void> {
  const resp = await apiFetch('/api/budgets', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category, ...updates }),
  })
  if (!resp.ok) throw new Error(`Failed to update budget: ${resp.status}`)
}

/** Moves money between envelopes (or from Ready to Assign) in one server-side transaction. */
export async function transferBudget(
  month: string,
  to: string,
  sources: { category: string; amount: number }[],
): Promise<void> {
  const resp = await apiFetch('/api/budgets/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, to, sources }),
  })
  if (!resp.ok) throw new Error(`Failed to transfer budget: ${resp.status}`)
}

export async function deleteBudget(month: string, category: string): Promise<void> {
  const resp = await apiFetch('/api/budgets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category }),
  })
  if (!resp.ok) throw new Error(`Failed to delete budget: ${resp.status}`)
}
