import { describe, it, expect } from 'vitest'
import { computeEnvelopes } from './budgetLoader'
import type { BudgetRow } from '../types/expense'

const categories = [{ name: 'Groceries', group: 'Essentials' }]
const groups = ['Essentials']

describe('computeEnvelopes', () => {
  it('computes assigned, spent, and available for a plain category', () => {
    const budgets: BudgetRow[] = [
      { month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 },
    ]
    const expenses = [{ date: '2026-01-05', amountInr: 1200, category: 'Groceries' }]

    const state = computeEnvelopes(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(5000)
    expect(groceries?.spent).toBe(1200)
    expect(groceries?.available).toBe(3800)
    expect(groceries?.isOverspent).toBe(false)
  })

  it('does not carry unspent balance into the next month', () => {
    const budgets: BudgetRow[] = [
      { month: '2025-12', category: 'Groceries', assigned: 5000, rolledOver: 0 },
      { month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 },
    ]
    const expenses = [{ date: '2025-12-10', amountInr: 3000, category: 'Groceries' }]

    const state = computeEnvelopes(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.rolledOver).toBe(0)
    expect(groceries?.available).toBe(5000)
  })

  it('carries forward the last month with an income row when the current month has none', () => {
    const budgets: BudgetRow[] = [
      { month: '2025-12', category: '__income__', assigned: 10000, rolledOver: 0 },
      { month: '2026-01', category: 'Groceries', assigned: 5000, rolledOver: 0 },
    ]

    const state = computeEnvelopes(budgets, [], '2026-01', categories, groups)

    expect(state.income).toBe(10000)
  })

  it("carries a category's last assigned amount into a month with no row of its own", () => {
    const budgets: BudgetRow[] = [{ month: '2025-12', category: 'Groceries', assigned: 9000, rolledOver: 0 }]

    const state = computeEnvelopes(budgets, [], '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(9000)
    expect(groceries?.available).toBe(9000)
  })

  it('an explicit row for this month, even assigned 0, overrides the carried amount', () => {
    const budgets: BudgetRow[] = [
      { month: '2025-12', category: 'Groceries', assigned: 9000, rolledOver: 0 },
      { month: '2026-01', category: 'Groceries', assigned: 0, rolledOver: 0 },
    ]

    const state = computeEnvelopes(budgets, [], '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.assigned).toBe(0)
  })

  it('flags an envelope as overspent when available drops below zero', () => {
    const budgets: BudgetRow[] = [
      { month: '2026-01', category: 'Groceries', assigned: 1000, rolledOver: 0 },
    ]
    const expenses = [{ date: '2026-01-05', amountInr: 1500, category: 'Groceries' }]

    const state = computeEnvelopes(budgets, expenses, '2026-01', categories, groups)
    const groceries = state.envelopes.find((e) => e.category === 'Groceries')

    expect(groceries?.available).toBe(-500)
    expect(groceries?.isOverspent).toBe(true)
  })

  it('excludes the credit-card envelope from totalAssigned/totalSpent', () => {
    const budgets: BudgetRow[] = [
      { month: '2026-01', category: 'Groceries', assigned: 1000, rolledOver: 0 },
      { month: '2026-01', category: '__credit_card__', assigned: 2000, rolledOver: 0 },
    ]
    const expenses = [{ date: '2026-01-05', amountInr: 500, category: '__credit_card__' }]

    const state = computeEnvelopes(budgets, expenses, '2026-01', categories, groups)

    expect(state.totalAssigned).toBe(1000)
    expect(state.totalSpent).toBe(0)
  })

  it('computes readyToAssign as income minus total assigned', () => {
    const budgets: BudgetRow[] = [
      { month: '2026-01', category: '__income__', assigned: 10000, rolledOver: 0 },
      { month: '2026-01', category: 'Groceries', assigned: 6000, rolledOver: 0 },
    ]

    const state = computeEnvelopes(budgets, [], '2026-01', categories, groups)

    expect(state.income).toBe(10000)
    expect(state.readyToAssign).toBe(4000)
    expect(state.isOverAssigned).toBe(false)
  })

  it('flags isOverAssigned when assigned exceeds income', () => {
    const budgets: BudgetRow[] = [
      { month: '2026-01', category: '__income__', assigned: 1000, rolledOver: 0 },
      { month: '2026-01', category: 'Groceries', assigned: 6000, rolledOver: 0 },
    ]

    const state = computeEnvelopes(budgets, [], '2026-01', categories, groups)

    expect(state.readyToAssign).toBe(-5000)
    expect(state.isOverAssigned).toBe(true)
  })
})
