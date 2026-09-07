import { describe, it, expect } from 'vitest'
import { advance, occurrencesDue, isExpired, firstRunOnOrAfter, MAX_BACKFILL } from './recurringExpense'

const base = {
  frequency: 'monthly',
  start_date: '2026-01-15',
  end_date: '',
  next_run_date: '2026-01-15',
  status: 'active',
}

describe('advance', () => {
  it('advances one day / week / month / year', () => {
    expect(advance('2026-09-07', 'daily')).toBe('2026-09-08')
    expect(advance('2026-09-07', 'weekly')).toBe('2026-09-14')
    expect(advance('2026-09-07', 'monthly')).toBe('2026-10-07')
    expect(advance('2026-09-07', 'yearly')).toBe('2027-09-07')
  })

  it('rolls across month and year boundaries', () => {
    expect(advance('2026-08-31', 'daily')).toBe('2026-09-01')
    expect(advance('2026-12-28', 'weekly')).toBe('2027-01-04')
    expect(advance('2026-12-15', 'monthly')).toBe('2027-01-15')
  })

  it('clamps a monthly 31st into a shorter month instead of overflowing', () => {
    // `subscriptions.ts::rollForward` would give 2026-03-03 here.
    expect(advance('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advance('2026-03-31', 'monthly')).toBe('2026-04-30')
  })

  it('does not drift once clamped, when given the anchor day', () => {
    // Feb 28 + monthly must return to the 31st, not stay on the 28th.
    expect(advance('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(advance('2026-04-30', 'monthly', 31)).toBe('2026-05-31')
  })

  it('clamps a yearly Feb 29 into a non-leap year', () => {
    expect(advance('2028-02-29', 'yearly')).toBe('2029-02-28')
    expect(advance('2029-02-28', 'yearly', 29)).toBe('2030-02-28')
    expect(advance('2031-02-28', 'yearly', 29)).toBe('2032-02-29')
  })

  it('returns the input unchanged for an unknown frequency', () => {
    expect(advance('2026-09-07', 'fortnightly')).toBe('2026-09-07')
  })
})

describe('occurrencesDue', () => {
  it('returns the single occurrence due exactly today', () => {
    expect(occurrencesDue({ ...base, next_run_date: '2026-09-15' }, '2026-09-15')).toEqual(['2026-09-15'])
  })

  it('returns nothing when the next run is still in the future', () => {
    expect(occurrencesDue({ ...base, next_run_date: '2026-09-16' }, '2026-09-15')).toEqual([])
  })

  it('backfills every missed occurrence, each on its own date', () => {
    const weekly = { ...base, frequency: 'weekly', start_date: '2026-08-18', next_run_date: '2026-08-18' }
    expect(occurrencesDue(weekly, '2026-09-07')).toEqual(['2026-08-18', '2026-08-25', '2026-09-01'])
  })

  it('backfills monthly without drifting off a clamped month-end', () => {
    const monthly = { ...base, start_date: '2026-01-31', next_run_date: '2026-01-31' }
    expect(occurrencesDue(monthly, '2026-04-01')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('includes an occurrence landing exactly on end_date and stops after it', () => {
    const ending = { ...base, frequency: 'weekly', start_date: '2026-09-01', next_run_date: '2026-09-01', end_date: '2026-09-08' }
    expect(occurrencesDue(ending, '2026-09-30')).toEqual(['2026-09-01', '2026-09-08'])
  })

  it('returns nothing once end_date has passed', () => {
    expect(occurrencesDue({ ...base, next_run_date: '2026-09-15', end_date: '2026-09-14' }, '2026-09-20')).toEqual([])
  })

  it('returns nothing for a paused or ended recurrence', () => {
    expect(occurrencesDue({ ...base, next_run_date: '2026-09-15', status: 'paused' }, '2026-09-15')).toEqual([])
    expect(occurrencesDue({ ...base, next_run_date: '2026-09-15', status: 'ended' }, '2026-09-15')).toEqual([])
  })

  it('returns nothing when next_run_date is missing or unparseable', () => {
    expect(occurrencesDue({ ...base, next_run_date: '' }, '2026-09-15')).toEqual([])
    expect(occurrencesDue({ ...base, next_run_date: 'not-a-date' }, '2026-09-15')).toEqual([])
  })

  it('caps a runaway backfill instead of spinning', () => {
    const daily = { ...base, frequency: 'daily', start_date: '2019-01-01', next_run_date: '2019-01-01' }
    const due = occurrencesDue(daily, '2026-09-07')
    expect(due).toHaveLength(MAX_BACKFILL)
    expect(due[0]).toBe('2019-01-01')
  })
})

describe('isExpired', () => {
  it('is true only once end_date is strictly in the past', () => {
    expect(isExpired({ ...base, end_date: '2026-09-06' }, '2026-09-07')).toBe(true)
    expect(isExpired({ ...base, end_date: '2026-09-07' }, '2026-09-07')).toBe(false)
    expect(isExpired({ ...base, end_date: '2026-09-08' }, '2026-09-07')).toBe(false)
  })

  it('is false when there is no end_date', () => {
    expect(isExpired(base, '2030-01-01')).toBe(false)
  })
})

describe('firstRunOnOrAfter', () => {
  it('keeps a future start date as-is', () => {
    expect(firstRunOnOrAfter('2026-09-20', 'monthly', '2026-09-07')).toBe('2026-09-20')
  })

  it('keeps a start date of exactly today', () => {
    expect(firstRunOnOrAfter('2026-09-07', 'monthly', '2026-09-07')).toBe('2026-09-07')
  })

  it('walks a backdated start forward so creating a recurrence never backfills history', () => {
    expect(firstRunOnOrAfter('2026-01-15', 'monthly', '2026-09-07')).toBe('2026-09-15')
    expect(firstRunOnOrAfter('2026-08-18', 'weekly', '2026-09-07')).toBe('2026-09-08')
  })
})
