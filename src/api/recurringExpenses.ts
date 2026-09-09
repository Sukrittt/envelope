import { apiFetch } from './client'
import type { CsvResponse, RecurringExpenseRow } from '@/src/types'

/** Fields the server accepts on create; `next_run_date` and `status` are its own to set. */
export interface RecurringExpenseInput {
  item: string
  amount_inr: string
  category: string
  frequency: string
  start_date: string
  end_date?: string
  notes?: string
  payment_method?: string
}

async function failure(resp: Response, verb: string): Promise<never> {
  const detail = await resp.json().catch(() => ({}))
  throw new Error(detail.error ?? `Failed to ${verb} recurring expense: ${resp.status}`)
}

export async function getRecurringExpenses(): Promise<RecurringExpenseRow[]> {
  const resp = await apiFetch('/api/recurring-expenses')
  if (!resp.ok) throw new Error(`Failed to load recurring expenses: ${resp.status}`)
  const data: CsvResponse<RecurringExpenseRow> = await resp.json()
  return data.rows
}

export async function addRecurringExpense(row: RecurringExpenseInput): Promise<void> {
  const resp = await apiFetch('/api/recurring-expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) await failure(resp, 'add')
}

export async function updateRecurringExpense(
  id: string,
  updates: Partial<RecurringExpenseInput> & { status?: string },
): Promise<void> {
  const resp = await apiFetch('/api/recurring-expenses', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
  if (!resp.ok) await failure(resp, 'update')
}

export async function pauseRecurringExpense(id: string): Promise<void> {
  await updateRecurringExpense(id, { status: 'paused' })
}

export async function resumeRecurringExpense(id: string): Promise<void> {
  await updateRecurringExpense(id, { status: 'active' })
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  const resp = await apiFetch('/api/recurring-expenses', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!resp.ok) await failure(resp, 'delete')
}
