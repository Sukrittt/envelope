import { describe, expect, it } from 'vitest'
import { toISTDateString, todayIST } from './date'

describe('toISTDateString', () => {
  it('converts a UTC instant to its IST calendar date', () => {
    // 2026-08-31T20:00:00Z + 5:30 = 2026-09-01T01:30:00 IST.
    expect(toISTDateString(new Date('2026-08-31T20:00:00Z'))).toBe('2026-09-01')
  })

  it('does not roll back a day for an instant still in the same IST date', () => {
    expect(toISTDateString(new Date('2026-09-01T10:00:00Z'))).toBe('2026-09-01')
  })

  it('defaults to the current instant', () => {
    expect(todayIST()).toBe(toISTDateString())
  })
})
