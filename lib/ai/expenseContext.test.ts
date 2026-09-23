import { describe, it, expect } from 'vitest'
import { summarizeExpenses, factsFor, factsWindowStart, FACT_SECTIONS, type SummarizeExpensesInput } from './expenseContext'

const input: SummarizeExpensesInput = {
  expenses: [
    { date: '2026-09-04', item: 'Swiggy dinner', amount_inr: 640, category: 'Food' },
    { date: '2026-09-02', item: 'Metro card', amount_inr: 300, category: 'Travel' },
    { date: '2026-08-12', item: 'Swiggy lunch', amount_inr: 420, category: 'Food' },
    { date: '2026-09-01', item: 'Salary', amount_inr: 90000, category: '__income__' },
  ],
  budgets: [
    // Income lives in `budgets` under the sentinel category, not in `expenses`.
    { month: '2026-09', category: '__income__', assigned: 90000, rolled_over: 0 },
    { month: '2026-09', category: 'Food', assigned: 8000, rolled_over: 0 },
    { month: '2026-09', category: 'Travel', assigned: 2000, rolled_over: 0 },
  ],
  categories: [{ name: 'Food', group: 'Needs' }, { name: 'Travel', group: 'Needs' }],
  groups: [{ name: 'Needs' }],
  subscriptions: [{ service: 'Netflix', amount_inr: 649, billing_cycle: 'monthly' }],
  holdings: [{ name: 'Nifty Index Fund', type: 'Equity', value: 120000 }],
  currentMonth: '2026-09',
  today: '2026-09-23',
}

describe('summarizeExpenses sections', () => {
  it('returns one string per known section', () => {
    const { sections } = summarizeExpenses(input)
    expect(Object.keys(sections).sort()).toEqual([...FACT_SECTIONS].sort())
    expect(sections.header).toContain('MONTH: 2026-09')
    expect(sections.envelopes).toContain('Food|Needs|')
    expect(sections.transactions).toContain('Swiggy dinner')
    expect(sections.subscriptions).toContain('Netflix')
    expect(sections.investments).toContain('Nifty Index Fund')
  })

  it('keeps `facts` equal to every section joined in order', () => {
    const { facts, sections } = summarizeExpenses(input)
    expect(facts).toBe(FACT_SECTIONS.map((s) => sections[s]).join('\n\n'))
  })

  it('never leaks sentinel categories into the envelope list', () => {
    const { sections } = summarizeExpenses(input)
    expect(sections.envelopes).not.toContain('__income__')
    expect(sections.header).toContain('INCOME: 90000')
  })
})

describe('factsFor', () => {
  it('includes only the requested sections, in canonical order', () => {
    const { sections } = summarizeExpenses(input)
    const sliced = factsFor(sections, ['envelopes', 'header'])
    expect(sliced).toBe(`${sections.header}\n\n${sections.envelopes}`)
  })

  it('drops the transaction rows when they are not requested', () => {
    const { sections } = summarizeExpenses(input)
    const sliced = factsFor(sections, ['header', 'envelopes'])
    expect(sliced).not.toContain('Swiggy dinner')
    expect(sliced.length).toBeLessThan(factsFor(sections, [...FACT_SECTIONS]).length)
  })

  it('de-duplicates repeated sections', () => {
    const { sections } = summarizeExpenses(input)
    expect(factsFor(sections, ['header', 'header'])).toBe(sections.header)
  })
})

describe('factsWindowStart', () => {
  it('reaches back far enough to cover every section the facts report', () => {
    // Six trend months inclusive of the current one, so five whole months back.
    expect(factsWindowStart('2026-09-23')).toBe('2026-04-01')
  })

  it('crosses the year boundary', () => {
    expect(factsWindowStart('2026-02-14')).toBe('2025-09-01')
  })

  it('starts on or before the oldest date any section uses', () => {
    const today = '2026-09-23'
    const start = factsWindowStart(today)
    const ninetyDaysAgo = new Date(`${today}T00:00:00`)
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    expect(start <= ninetyDaysAgo.toISOString().slice(0, 10)).toBe(true)
  })
})
