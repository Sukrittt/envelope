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
  const resp = await fetch('/api/budgets')
  if (!resp.ok) throw new Error(`Failed to load budgets: ${resp.status}`)
  const data: CsvResponse<BudgetRow> = await resp.json()
  return data.rows
}

export async function addBudget(row: Omit<BudgetRow, 'rolled_over'> & { rolled_over?: string }): Promise<void> {
  const resp = await fetch('/api/budgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, rolled_over: row.rolled_over ?? '0' }),
  })
  if (!resp.ok) throw new Error(`Failed to add budget: ${resp.status}`)
}

export async function updateBudget(month: string, category: string, updates: Partial<BudgetRow>): Promise<void> {
  const resp = await fetch('/api/budgets', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category, ...updates }),
  })
  if (!resp.ok) throw new Error(`Failed to update budget: ${resp.status}`)
}

export async function deleteBudget(month: string, category: string): Promise<void> {
  const resp = await fetch('/api/budgets', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, category }),
  })
  if (!resp.ok) throw new Error(`Failed to delete budget: ${resp.status}`)
}

export async function getExpenses(): Promise<ExpenseRow[]> {
  const resp = await fetch('/api/expenses')
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
}): Promise<void> {
  const resp = await fetch('/api/expenses', {
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
  const resp = await fetch('/api/category-map')
  if (!resp.ok) throw new Error(`Failed to load category map: ${resp.status}`)
  return resp.json()
}
