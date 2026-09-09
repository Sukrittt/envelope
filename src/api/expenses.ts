import { apiFetch, HttpError } from './client'
import { nowIST } from '@/src/lib/date'
import type { CsvResponse, ExpenseRow } from '@/src/types'

export async function getExpenses(): Promise<ExpenseRow[]> {
  const resp = await apiFetch('/api/expenses')
  if (!resp.ok) throw new Error(`Failed to load expenses: ${resp.status}`)
  const data: CsvResponse<ExpenseRow> = await resp.json()
  return data.rows
}

export type NewExpenseRow = {
  item: string
  amount_inr: string
  category: string
  date?: string
  notes?: string
  payment_method?: string
}

/** The exact body a POST /api/expenses create sends, `client_id` included. */
export type ExpensePayload = NewExpenseRow & { client_id: string; date: string; timestamp: string }

/**
 * Mints the parts of a create that must be decided once, at capture time, and
 * never again: `client_id` names this create so a retry (offline queue, or a
 * lost response) is recognized as the same intent instead of inserting a
 * second row. `timestamp` is minted from the device's clock the same way the
 * server derives it (`date` + current IST time-of-day) so an expense logged
 * offline is dated the day it was actually logged, not the day the queue
 * happens to flush.
 */
export function mintExpensePayload(row: NewExpenseRow): ExpensePayload {
  const ist = nowIST()
  const date = row.date || ist.date
  return { ...row, date, timestamp: `${date}T${ist.timestamp.slice(11)}`, client_id: crypto.randomUUID() }
}

/** Resolves with the created (or, on a client_id replay, already-existing) row's identity. */
export async function postExpensePayload(payload: ExpensePayload): Promise<{ id?: string; timestamp?: string }> {
  const resp = await apiFetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new HttpError(resp.status, `Failed to add expense: ${resp.status}`)
  const data: { id?: string; timestamp?: string } = await resp.json().catch(() => ({}))
  return { id: data.id, timestamp: data.timestamp }
}

/**
 * Resolves with the created row's identity. `id`/`timestamp` are optional
 * because an offline caller (useAddExpense) never gets this far — it mints
 * its own payload via `mintExpensePayload` up front so it has something to
 * enqueue if the POST itself never happens.
 */
export async function addExpense(row: NewExpenseRow): Promise<{ id?: string; timestamp?: string }> {
  return postExpensePayload(mintExpensePayload(row))
}

/**
 * `id` (the expense's real Mongo _id) addresses the exact row when present —
 * pass it whenever the caller has one. `timestamp`/`item`/`amountInr` are
 * kept as a fallback triple-match on the server for one release, so this
 * still works during rollout, but two expenses with the same timestamp/item/
 * amount are only addressed correctly via `id`.
 */
export async function updateExpense(
  id: string | undefined,
  timestamp: string,
  item: string,
  amountInr: number,
  updates: {
    new_item?: string
    new_amount_inr?: string
    new_date?: string
    new_payment_method?: string
    category?: string
  },
): Promise<void> {
  const resp = await apiFetch('/api/expenses', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, timestamp, item, amount_inr: String(amountInr), ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update expense: ${resp.status}`)
  }
}

export async function updateExpenseCategory(
  id: string | undefined,
  timestamp: string,
  item: string,
  amountInr: number,
  category: string,
): Promise<void> {
  await updateExpense(id, timestamp, item, amountInr, { category })
}

export async function deleteExpense(
  id: string | undefined,
  timestamp: string,
  item: string,
  amountInr: number,
): Promise<void> {
  const resp = await apiFetch('/api/expenses', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, timestamp, item, amount_inr: String(amountInr) }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to delete expense: ${resp.status}`)
  }
}
