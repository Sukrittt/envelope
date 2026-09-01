import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({ invalidate: vi.fn() }))

const holdingsFindOne = vi.fn()
const holdingsUpdateOne = vi.fn()
const budgetsFindOne = vi.fn()
const eventsInsertOne = vi.fn()

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async (base: string) => {
      if (base === 'holdings') return { findOne: holdingsFindOne, updateOne: holdingsUpdateOne }
      if (base === 'budgets') return { findOne: budgetsFindOne }
      if (base === 'holding_events') return { insertOne: eventsInsertOne }
      throw new Error(`unexpected collection ${base}`)
    }),
  }
})

const { applyHoldingAction } = await import('./holdings')

const auth = { userId: 'user_a', readOnly: false, sessionId: null }

describe('applyHoldingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a 404 result when the holding does not exist', async () => {
    holdingsFindOne.mockResolvedValueOnce(null)
    const result = await applyHoldingAction(auth, { name: 'Stocks', action: 'contribution', amount: 100 })
    expect(result).toEqual({ ok: false, error: 'holding not found', status: 404 })
  })

  it('contribution adds to the holding value and never touches budgets', async () => {
    holdingsFindOne.mockResolvedValueOnce({ name: 'Stocks', value: '1000' })

    const result = await applyHoldingAction(auth, { name: 'Stocks', action: 'contribution', amount: 200 })

    expect(result).toEqual({ ok: true, previousValue: 1000, newValue: 1200 })
    expect(holdingsUpdateOne).toHaveBeenCalledWith({ name: 'Stocks' }, { $set: expect.objectContaining({ value: '1200' }) })
    expect(budgetsFindOne).not.toHaveBeenCalled()
    expect(eventsInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'contribution', previous_value: '1000', new_value: '1200' }),
    )
  })

  it('withdrawal subtracts from the holding value, floored at 0, and never touches budgets', async () => {
    holdingsFindOne.mockResolvedValueOnce({ name: 'Stocks', value: '150' })

    const result = await applyHoldingAction(auth, { name: 'Stocks', action: 'withdrawal', amount: 500 })

    expect(result).toEqual({ ok: true, previousValue: 150, newValue: 0 })
    expect(budgetsFindOne).not.toHaveBeenCalled()
  })

  it('market_update replaces the value outright and never touches budgets', async () => {
    holdingsFindOne.mockResolvedValueOnce({ name: 'Stocks', value: '1000' })

    const result = await applyHoldingAction(auth, { name: 'Stocks', action: 'market_update', amount: 1350 })

    expect(result).toEqual({ ok: true, previousValue: 1000, newValue: 1350 })
    expect(budgetsFindOne).not.toHaveBeenCalled()
  })
})
