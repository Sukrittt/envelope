import { describe, expect, it } from 'vitest'
import { buildCandidates, nextSuggestedDate, scanWindow } from './recurringDetection'
const rows = ['2026-07-05', '2026-08-05', '2026-09-05'].map((date, i) => ({ _id: String(i), date, item: 'Netflix', amount_inr: '649', category: 'Entertainment', payment_method: 'bank' }))
describe('recurring candidates', () => {
  it('groups normalized names and requires two distinct payment dates', () => {
    expect(buildCandidates(rows, [], 'INR')).toHaveLength(1)
    expect(buildCandidates(rows.slice(0, 2), [], 'INR')).toHaveLength(1)
    expect(buildCandidates(rows.slice(0, 1), [], 'INR')).toHaveLength(0)
    expect(buildCandidates(rows.map(r => ({ ...r, date: rows[0].date })), [], 'INR')).toHaveLength(0)
    expect(buildCandidates([rows[0], { ...rows[1], item: ' NETFLIX ' }, rows[2]], [], 'INR')).toHaveLength(1)
  })
  it('excludes already tracked names, generated payments, refunds and invalid values', () => {
    expect(buildCandidates(rows, ['Netflix'], 'INR')).toHaveLength(0)
    for (const change of [{ source: 'recurring' }, { amount_inr: '-1' }, { amount_inr: 'Infinity' }, { date: '2026-02-31' }, { source: 'transfer' }]) {
      expect(buildCandidates(rows.map(r => ({ ...r, ...change })), [], 'INR')).toHaveLength(0)
    }
  })
  it('fingerprints edits and currency, but not input ordering', () => {
    const first = buildCandidates(rows, [], 'INR')[0]
    expect(buildCandidates([...rows].reverse(), [], 'INR')[0].fingerprint).toBe(first.fingerprint)
    expect(buildCandidates(rows.map(r => ({ ...r, amount_inr: '699' })), [], 'INR')[0].fingerprint).not.toBe(first.fingerprint)
    expect(buildCandidates(rows, [], 'USD')[0].fingerprint).not.toBe(first.fingerprint)
  })
  it('does not combine payment methods', () => {
    expect(buildCandidates(rows.slice(0, 2).map((r, i) => ({ ...r, payment_method: i ? 'bank' : 'credit_card' })), [], 'INR')).toHaveLength(0)
  })
  it('suggests strictly future dates with month-end clamping', () => {
    expect(nextSuggestedDate('2026-08-31', 'monthly', '2026-09-30')).toBe('2026-10-31')
    expect(nextSuggestedDate('2026-09-05', 'monthly', '2026-09-22')).toBe('2026-10-05')
  })
})

it('clamps selectable month windows to valid calendar dates', () => {
  expect(scanWindow('2026-03-31', 1)).toBe('2026-02-28')
  expect(scanWindow('2026-09-22', 3)).toBe('2026-06-22')
  expect(scanWindow('2026-09-22', 6)).toBe('2026-03-22')
})

it('sends two monthly rent payments forward for evaluation', () => {
  const rent = ['2026-08-05', '2026-09-05'].map((date, i) => ({ _id: String(i), date, item: 'Rent', amount_inr: 5000, category: 'Housing' }))
  const candidates = buildCandidates(rent, [], 'INR')
  expect(candidates).toHaveLength(1)
  expect(candidates[0].payments.map(p => p.amount)).toEqual([5000, 5000])
})
