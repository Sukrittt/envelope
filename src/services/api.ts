import { isGuest } from './accessMode'

export function apiUrl(path: string): string {
  const delim = path.includes('?') ? '&' : '?'
  return isGuest() ? `${path}${delim}mode=guest` : path
}

export interface BudgetRow {
  month: string
  category: string
  assigned: string
  rolled_over: string
}

export interface ExpenseRow {
  timestamp: string
  date: string
  item: string
  amount_inr: string
  category: string
  notes: string
  source: string
  amount: string
  description: string
  payment_method: string
}

interface CsvResponse<T> {
  headers: string[]
  rows: T[]
}

export async function getBudgets(): Promise<BudgetRow[]> {
  const resp = await fetch(apiUrl('/api/budgets'))
  if (!resp.ok) throw new Error(`Failed to load budgets: ${resp.status}`)
  const data: CsvResponse<BudgetRow> = await resp.json()
  return data.rows
}

export async function addBudget(row: Omit<BudgetRow, 'rolled_over'> & { rolled_over?: string }): Promise<void> {
  const resp = await fetch(apiUrl('/api/budgets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, rolled_over: row.rolled_over ?? '0' }),
  })
  if (!resp.ok) throw new Error(`Failed to add budget: ${resp.status}`)
}

export async function updateBudget(month: string, category: string, updates: Partial<BudgetRow & { newCategory?: string }>): Promise<void> {
  const resp = await fetch(apiUrl('/api/budgets'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category, ...updates }),
  })
  if (!resp.ok) throw new Error(`Failed to update budget: ${resp.status}`)
}

export async function deleteBudget(month: string, category: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/budgets'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category }),
  })
  if (!resp.ok) throw new Error(`Failed to delete budget: ${resp.status}`)
}

export interface CategoryRow {
  name: string
  group: string
}

export async function getCategories(): Promise<CategoryRow[]> {
  const resp = await fetch(apiUrl('/api/categories'))
  if (!resp.ok) throw new Error(`Failed to load categories: ${resp.status}`)
  return resp.json()
}

export async function addCategory(name: string, group = ''): Promise<void> {
  const resp = await fetch(apiUrl('/api/categories'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, group }),
  })
  if (!resp.ok) throw new Error(`Failed to add category: ${resp.status}`)
}

export async function updateCategory(name: string, updates: { newName?: string; group?: string }): Promise<void> {
  const resp = await fetch(apiUrl('/api/categories'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...updates }),
  })
  if (!resp.ok) throw new Error(`Failed to update category: ${resp.status}`)
}

export async function deleteCategory(name: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/categories'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) throw new Error(`Failed to delete category: ${resp.status}`)
}

export async function reorderCategory(name: string, direction: 'up' | 'down'): Promise<void> {
  const resp = await fetch(apiUrl('/api/categories/reorder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, direction }),
  })
  if (!resp.ok) throw new Error(`Failed to reorder category: ${resp.status}`)
}

export async function moveCategory(name: string, toIndex: number): Promise<void> {
  const resp = await fetch(apiUrl('/api/categories/move'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, toIndex }),
  })
  if (!resp.ok) throw new Error(`Failed to move category: ${resp.status}`)
}

export async function getGroups(): Promise<string[]> {
  const resp = await fetch(apiUrl('/api/groups'))
  if (!resp.ok) throw new Error(`Failed to load groups: ${resp.status}`)
  return resp.json()
}

export async function addGroup(name: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/groups'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) throw new Error(`Failed to add group: ${resp.status}`)
}

export async function updateGroup(name: string, newName: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/groups'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, newName }),
  })
  if (!resp.ok) throw new Error(`Failed to update group: ${resp.status}`)
}

export async function deleteGroup(name: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/groups'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) throw new Error(`Failed to delete group: ${resp.status}`)
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  const resp = await fetch(apiUrl('/api/expenses'))
  if (!resp.ok) throw new Error(`Failed to load expenses: ${resp.status}`)
  const data: CsvResponse<ExpenseRow> = await resp.json()
  return data.rows
}

export async function addExpense(row: {
  item: string
  amount_inr: string
  category: string
  date?: string
  notes?: string
  payment_method?: string
}): Promise<void> {
  const resp = await fetch(apiUrl('/api/expenses'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) throw new Error(`Failed to add expense: ${resp.status}`)
}

export interface CategoryMap {
  words: Record<string, string>
  updatedAt: string
}

export async function getCategoryMap(): Promise<CategoryMap> {
  const resp = await fetch(apiUrl('/api/category-map'))
  if (!resp.ok) throw new Error(`Failed to load category map: ${resp.status}`)
  return resp.json()
}

export async function updateExpenseCategory(
  timestamp: string,
  item: string,
  amountInr: number,
  category: string,
): Promise<void> {
  const resp = await fetch(apiUrl('/api/expenses'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp, item, amount_inr: String(amountInr), category }),
  })
  if (!resp.ok) throw new Error(`Failed to update expense: ${resp.status}`)
}

export interface SubscriptionRow {
  timestamp: string
  service: string
  amount_inr: string
  billing_cycle: string
  next_due_date: string
  status: string
  renewal_or_end_month: string
  notes: string
}

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const resp = await fetch(apiUrl('/api/subscriptions'))
  if (!resp.ok) throw new Error(`Failed to load subscriptions: ${resp.status}`)
  const data: CsvResponse<SubscriptionRow> = await resp.json()
  return data.rows
}

export async function updateSubscription(
  service: string,
  updates: {
    new_service?: string
    amount_inr?: string
    billing_cycle?: string
    next_due_date?: string
    notes?: string
    status?: string
  },
): Promise<void> {
  const resp = await fetch(apiUrl('/api/subscriptions'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update subscription: ${resp.status}`)
  }
}

export async function cancelSubscription(service: string): Promise<void> {
  await updateSubscription(service, { status: 'cancelled' })
}

export async function reactivateSubscription(service: string): Promise<void> {
  await updateSubscription(service, { status: 'active' })
}

export async function addSubscription(row: {
  service: string
  amount_inr: string
  billing_cycle?: string
  next_due_date?: string
  notes?: string
}): Promise<void> {
  const resp = await fetch(apiUrl('/api/subscriptions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to add subscription: ${resp.status}`)
  }
}

export interface HoldingRow {
  name: string
  type: string
  value: string
  updated_at: string
}

export async function getHoldings(): Promise<HoldingRow[]> {
  const resp = await fetch(apiUrl('/api/holdings'))
  if (!resp.ok) throw new Error(`Failed to load holdings: ${resp.status}`)
  const data: CsvResponse<HoldingRow> = await resp.json()
  return data.rows
}

export async function addHolding(row: { name: string; type: string; value: string }): Promise<void> {
  const resp = await fetch(apiUrl('/api/holdings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to add holding: ${resp.status}`)
  }
}

export async function updateHolding(
  name: string,
  updates: { new_name?: string; type?: string; value?: string; updated_at?: string },
): Promise<void> {
  const resp = await fetch(apiUrl('/api/holdings'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update holding: ${resp.status}`)
  }
}

export interface HoldingEventRow {
  holding_name: string
  event_type: string
  amount: string
  previous_value: string
  new_value: string
  timestamp: string
}

export async function getHoldingEvents(): Promise<HoldingEventRow[]> {
  const resp = await fetch(apiUrl('/api/holding-events'))
  if (!resp.ok) throw new Error(`Failed to load holding events: ${resp.status}`)
  const data: CsvResponse<HoldingEventRow> = await resp.json()
  return data.rows
}

export async function performHoldingAction(params: {
  name: string
  action: 'market_update' | 'contribution' | 'withdrawal'
  amount: number
  month: string
}): Promise<{ previousValue: number; newValue: number }> {
  const resp = await fetch(apiUrl('/api/holdings/action'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed: ${resp.status}`)
  }
  return resp.json()
}

export async function deleteHolding(name: string): Promise<void> {
  const resp = await fetch(apiUrl('/api/holdings'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to delete holding: ${resp.status}`)
  }
}