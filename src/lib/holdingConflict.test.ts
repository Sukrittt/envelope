import { describe, expect, it } from 'vitest'
import { holdingChanges, holdingDraft, rebaseHoldingDraft } from './holdingConflict'
import type { HoldingRow } from '@/src/types'

const row = (overrides: Partial<HoldingRow> = {}): HoldingRow => ({
  name: 'Stocks',
  type: 'Equity',
  value: '1000',
  updated_at: '2026-09-22',
  is_recurring: 'true',
  recurring_amount: '100',
  recurring_day: '1',
  recurring_last_run: '2026-09',
  version: 4,
  ...overrides,
})

describe('holding recurrence conflicts', () => {
  it('sends the recurrence pair only when that logical setting changed', () => {
    const original = holdingDraft(row())
    expect(holdingChanges(original, original)).toEqual({})
    expect(holdingChanges(original, { isRecurring: true, recurringAmount: '250' })).toEqual({
      is_recurring: true,
      recurring_amount: '250',
    })
    expect(holdingChanges(original, { isRecurring: false, recurringAmount: '100' })).toEqual({
      is_recurring: false,
    })
  })

  it('keeps the complete user draft when rebasing over a conflicting switch change', () => {
    const original = holdingDraft(row())
    const latest = row({ is_recurring: 'false', recurring_amount: '', version: 5 })

    expect(rebaseHoldingDraft(original, { isRecurring: true, recurringAmount: '250' }, latest)).toEqual({
      isRecurring: true,
      recurringAmount: '250',
    })
  })

  it('uses the latest setting when the user draft was unchanged', () => {
    const original = holdingDraft(row())
    const latest = row({ is_recurring: 'true', recurring_amount: '175', version: 5 })

    expect(rebaseHoldingDraft(original, original, latest)).toEqual({ isRecurring: true, recurringAmount: '175' })
  })
})
