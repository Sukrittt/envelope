/**
 * Mongo document models + CSV header arrays.
 *
 * Documents are stored with the same snake_case field names as the legacy CSV
 * headers, so the existing client mapping in `src/services/api.ts` and the
 * `{ headers, rows }` response shapes need no changes.
 */

export const EXPENSE_HEADERS = [
  'timestamp',
  'date',
  'item',
  'amount_inr',
  'category',
  'notes',
  'source',
  'amount',
  'description',
  'payment_method',
]

export const BUDGET_HEADERS = ['month', 'category', 'assigned', 'rolled_over']

export const CATEGORY_HEADERS = ['name', 'group']

export const GROUP_HEADERS = ['name']

export const SUBSCRIPTION_HEADERS = [
  'timestamp',
  'service',
  'amount_inr',
  'billing_cycle',
  'next_due_date',
  'status',
  'renewal_or_end_month',
  'notes',
]

export const HOLDING_HEADERS = ['name', 'type', 'value', 'updated_at']

export const HOLDING_EVENT_HEADERS = [
  'holding_name',
  'event_type',
  'amount',
  'previous_value',
  'new_value',
  'timestamp',
]

/** Base (non-demo) collection names, mirroring the legacy CSV file stems. */
export const COLLECTIONS = {
  expenses: 'expenses',
  budgets: 'budgets',
  categories: 'categories',
  groups: 'groups',
  subscriptions: 'subscriptions',
  holdings: 'holdings',
  holdingEvents: 'holding_events',
} as const

/** One CSV-ish row; every value is a string so it round-trips exactly. */
export type Row = Record<string, string>

/**
 * Project a stored Mongo doc onto a full header-shaped row, defaulting missing
 * fields to '' — the same behaviour the CSV `{ headers, rows }` API produced.
 */
export function toRow(headers: string[], doc: Record<string, unknown>): Row {
  const row: Row = {}
  for (const header of headers) {
    const value = doc[header]
    row[header] = value === undefined || value === null ? '' : String(value)
  }
  return row
}
