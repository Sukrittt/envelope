import { describe, it, expect, vi, beforeEach } from 'vitest'

let docs: Array<{ amount_inr: string }> = []
const findMock = vi.fn(() => ({ toArray: async () => docs }))
vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => ({ find: findMock })),
  }
})

const { currentEdition, monthRange, editionStatus, WRAPPED_MIN_TRANSACTIONS } = await import('./wrapped')

function row(amountInr: number) {
  return { amount_inr: String(amountInr) }
}

beforeEach(() => {
  docs = []
})

describe('currentEdition', () => {
  it('returns the previous month within a year', () => {
    expect(currentEdition('2026-09-15')).toBe('2026-08')
  })

  it('wraps across a year boundary', () => {
    expect(currentEdition('2026-01-10')).toBe('2025-12')
  })
})

describe('monthRange', () => {
  it('spans the full month, 31 days', () => {
    expect(monthRange('2026-08')).toEqual({ start: '2026-08-01', end: '2026-08-31' })
  })

  it('spans the full month, 30 days', () => {
    expect(monthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('handles February in a leap year', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('handles February in a non-leap year', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
})

const AUTH = { userId: 'u1', readOnly: false, sessionId: null }

describe('editionStatus', () => {
  it('is unavailable one below the threshold', async () => {
    docs = Array.from({ length: WRAPPED_MIN_TRANSACTIONS - 1 }, () => row(100))
    const status = await editionStatus(AUTH, '2026-08')
    expect(status.available).toBe(false)
    expect(status.transactionCount).toBe(WRAPPED_MIN_TRANSACTIONS - 1)
  })

  it('is available exactly at the threshold', async () => {
    docs = Array.from({ length: WRAPPED_MIN_TRANSACTIONS }, () => row(100))
    const status = await editionStatus(AUTH, '2026-08')
    expect(status.available).toBe(true)
  })

  it('excludes zero/negative rows (refunds) from the count', async () => {
    docs = [...Array.from({ length: WRAPPED_MIN_TRANSACTIONS }, () => row(100)), row(0), row(-50)]
    const status = await editionStatus(AUTH, '2026-08')
    expect(status.transactionCount).toBe(WRAPPED_MIN_TRANSACTIONS)
  })

  it('queries the collection scoped to the month range', async () => {
    docs = []
    await editionStatus(AUTH, '2026-08')
    expect(findMock).toHaveBeenCalledWith({ date: { $gte: '2026-08-01', $lte: '2026-08-31' } })
  })
})
