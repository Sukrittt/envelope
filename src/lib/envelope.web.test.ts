import { describe, it, expect } from 'vitest'
import { computeEnvelopeState } from '../lib/envelope'
import type { BudgetRow, ExpenseRow } from '../types'

/**
 * budgetLoader's own suite, re-pointed at the ported computeEnvelopeState.
 * The two implementations must agree before budgetLoader can be retired: this
 * file is the evidence, and it stays as the web-side regression test for the
 * envelope maths afterwards.
 *
 * Only the row shapes are adapted. budgetLoader took numbers and camelCase;
 * computeEnvelopeState takes the wire rows the API actually returns, which is
 * what removes the conversion layer in the first place.
 */
function budget(row: { month: string; category: string; assigned: number; rolledOver?: number }): BudgetRow {
  return {
    month: row.month,
    category: row.category,
    assigned: String(row.assigned),
    rolled_over: String(row.rolledOver ?? 0),
  }
}

function expense(row: { date: string; amountInr: number; category: string }): ExpenseRow {
  return {
    date: row.date,
    amount_inr: String(row.amountInr),
    category: row.category,
    timestamp: `${row.date}T10:00:00+05:30`,
    item: 'x',
    notes: '',
    source: '',
    amount: '',
    description: '',
    payment_method: '',
  }
}

const categories = [{ name: 'Groceries', group: 'Essentials' }]
const groups = ['Essentials']

describe('computeEnvelopeState (ported from budgetLoader)', () => {
  it('computes assigned, spent, and available for a plain category', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 }),
    ]
    const expenses = [expense({ date: '2026-01-05', amountInr: 1200, category: 'Groceries' })]

    const state = computeEnvelopeState(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(5000)
    expect(groceries?.spent).toBe(1200)
    expect(groceries?.available).toBe(3800)
    expect(groceries?.isOverspent).toBe(false)
  })

  it('does not carry unspent balance into the next month', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2025-12', category: 'Groceries', assigned: 5000, rolledOver: 0 }),
      budget({ month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 }),
    ]
    const expenses = [expense({ date: '2025-12-10', amountInr: 3000, category: 'Groceries' })]

    const state = computeEnvelopeState(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.rolledOver).toBe(0)
    expect(groceries?.available).toBe(5000)
  })

  it('carries forward the last month with an income row when the current month has none', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2025-12', category: '__income__', assigned: 10000, rolledOver: 0 }),
      budget({ month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 }),
    ]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)

    expect(state.income).toBe(10000)
  })

  it("carries a category's last assigned amount into a month with no row of its own", () => {
    const budgets: BudgetRow[] = [budget({ month: '2025-12', category: 'Groceries', assigned: 9000, rolledOver: 0 })]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(9000)
    expect(groceries?.available).toBe(9000)
  })

  it('an explicit row for this month, even assigned 0, overrides the carried amount', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2025-12', category: 'Groceries', assigned: 9000, rolledOver: 0 }),
      budget({ month: '2026-01', category: 'Groceries', assigned: 0, rolledOver: 0 }),
    ]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(0)
  })

  it('flags an envelope as overspent when available drops below zero', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2026-01', category: 'Groceries', assigned: 1000, rolledOver: 0 }),
    ]
    const expenses = [expense({ date: '2026-01-05', amountInr: 1500, category: 'Groceries' })]

    const state = computeEnvelopeState(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.available).toBe(-500)
    expect(groceries?.isOverspent).toBe(true)
  })

  it('does not carry the credit-card payment envelope forward into a new month', () => {
    const budgets: BudgetRow[] = [budget({ month: '2025-12', category: '__credit_card__', assigned: 432.25, rolledOver: 0 })]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)
    const cc = state.envelopes.find((e) => e.category === '__credit_card__')

    expect(cc?.assigned).toBe(0)
  })

  it('excludes the credit-card envelope from totalAssigned/totalSpent', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2026-01', category: 'Groceries', assigned: 1000, rolledOver: 0 }),
      budget({ month: '2026-01', category: '__credit_card__', assigned: 2000, rolledOver: 0 }),
    ]
    const expenses = [expense({ date: '2026-01-05', amountInr: 500, category: '__credit_card__' })]

    const state = computeEnvelopeState(budgets, expenses, '2026-01', categories, groups)

    expect(state.totalAssigned).toBe(1000)
    expect(state.totalSpent).toBe(0)
  })

  it('computes readyToAssign as income minus total assigned', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2026-01', category: '__income__', assigned: 10000, rolledOver: 0 }),
      budget({ month: '2026-01', category: 'Groceries', assigned: 6000, rolledOver: 0 }),
    ]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)

    expect(state.income).toBe(10000)
    expect(state.readyToAssign).toBe(4000)
    expect(state.isOverAssigned).toBe(false)
  })

  it('flags isOverAssigned when assigned exceeds income', () => {
    const budgets: BudgetRow[] = [
      budget({ month: '2026-01', category: '__income__', assigned: 1000, rolledOver: 0 }),
      budget({ month: '2026-01', category: 'Groceries', assigned: 6000, rolledOver: 0 }),
    ]

    const state = computeEnvelopeState(budgets, [], '2026-01', categories, groups)

    expect(state.readyToAssign).toBe(-5000)
    expect(state.isOverAssigned).toBe(true)
  })
})

it('preserves paise in ready to assign', () => {
  const budgets = [
    budget({ month: '2026-01', category: '__income__', assigned: 1000 }),
    budget({ month: '2026-01', category: 'Groceries', assigned: 600.25 }),
  ]
  expect(computeEnvelopeState(budgets, [], '2026-01', categories, groups).readyToAssign).toBe(399.75)
})
