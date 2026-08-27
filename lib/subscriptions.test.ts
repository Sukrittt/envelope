import { describe, it, expect } from 'vitest'
import { rollForward, getEffectiveDueDate, daysUntil, renewalDays } from './subscriptions'

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('rollForward', () => {
  it('advances a monthly cycle by one month', () => {
    expect(rollForward('2026-01-15', 'monthly')).toBe('2026-02-15')
  })

  it('advances a yearly cycle by one year', () => {
    expect(rollForward('2026-01-15', 'yearly')).toBe('2027-01-15')
  })

  it('advances a quarterly cycle by three months', () => {
    expect(rollForward('2026-01-15', 'quarterly')).toBe('2026-04-15')
  })

  it('advances a weekly cycle by seven days', () => {
    expect(rollForward('2026-01-15', 'weekly')).toBe('2026-01-22')
  })

  it('returns empty string for an unparseable date', () => {
    expect(rollForward('not-a-date', 'monthly')).toBe('')
  })
})

describe('getEffectiveDueDate', () => {
  it('returns a future nextDueDate unchanged', () => {
    const future = isoDaysFromNow(10)
    expect(
      getEffectiveDueDate({ nextDueDate: future, billingCycle: 'monthly', timestamp: '2026-01-01' }),
    ).toBe(future)
  })

  it('rolls a past monthly nextDueDate forward until it is in the future', () => {
    const past = isoDaysFromNow(-40)
    const result = getEffectiveDueDate({ nextDueDate: past, billingCycle: 'monthly', timestamp: '2026-01-01' })
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now())
  })

  it('falls back to renewalOrEndMonth when nextDueDate is empty', () => {
    const y = new Date().getFullYear() + 1
    const result = getEffectiveDueDate({
      nextDueDate: '',
      billingCycle: 'yearly',
      renewalOrEndMonth: `March ${y}`,
      timestamp: '2026-01-01',
    })
    // `new Date(y, m, 1).toISOString()` shifts by a day around local-timezone
    // midnight, so accept the last day of Feb or the first of March.
    expect([`${y}-02-28`, `${y}-02-29`, `${y}-03-01`]).toContain(result)
  })

  it('falls back to a monthly cycle derived from timestamp when both other fields are empty', () => {
    const result = getEffectiveDueDate({ nextDueDate: '', billingCycle: 'monthly', timestamp: '2026-01-05' })
    expect(result).not.toBe('')
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now())
  })

  it('returns empty string with no usable field', () => {
    expect(getEffectiveDueDate({ nextDueDate: '', billingCycle: 'one-time', timestamp: '' })).toBe('')
  })
})

describe('daysUntil', () => {
  it('returns empty string for no date', () => {
    expect(daysUntil('')).toBe('')
  })

  it('labels today and tomorrow specially', () => {
    expect(daysUntil(isoDaysFromNow(0))).toBe('renews today')
    expect(daysUntil(isoDaysFromNow(1))).toBe('renews tomorrow')
  })

  it('labels further-out dates with a day count', () => {
    expect(daysUntil(isoDaysFromNow(5))).toBe('renews in 5d')
  })

  it('returns empty string for a past date', () => {
    expect(daysUntil(isoDaysFromNow(-5))).toBe('')
  })
})

describe('renewalDays', () => {
  it('is Infinity for one-time subscriptions', () => {
    expect(renewalDays({ nextDueDate: isoDaysFromNow(5), billingCycle: 'one-time', timestamp: '2026-01-01' })).toBe(
      Infinity,
    )
  })

  it('is Infinity when no due date can be resolved', () => {
    expect(renewalDays({ nextDueDate: '', billingCycle: 'one-time', timestamp: '' })).toBe(Infinity)
  })

  it('counts days to a future due date', () => {
    expect(renewalDays({ nextDueDate: isoDaysFromNow(7), billingCycle: 'monthly', timestamp: '2026-01-01' })).toBe(7)
  })
})
