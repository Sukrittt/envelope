import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache', () => ({ invalidate: vi.fn() }))
vi.mock('@/lib/categoryMap', () => ({ invalidateCategoryMap: vi.fn() }))
vi.mock('@/lib/notifications/instant', () => ({ notifyThresholdCrossed: vi.fn() }))

const insertOne = vi.fn()

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async (base: string) => {
      if (base === 'expenses') return { insertOne }
      throw new Error(`unexpected collection ${base}`)
    }),
  }
})

const { applySubscriptionExpense } = await import('./subscriptionExpense')
const { notifyThresholdCrossed } = await import('@/lib/notifications/instant')

const auth = { userId: 'user_a', readOnly: false, sessionId: null }

describe('applySubscriptionExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertOne.mockResolvedValue({ insertedId: 'exp_1' })
  })

  it('skips and does not insert when the subscription has no linked category', async () => {
    const result = await applySubscriptionExpense(auth, { service: 'Netflix', amount_inr: '199', category: '' })
    expect(result).toEqual({ ok: false, reason: 'no-category' })
    expect(insertOne).not.toHaveBeenCalled()
  })

  it('inserts an expense marked as auto-generated, in the linked category', async () => {
    const result = await applySubscriptionExpense(auth, {
      service: 'Netflix',
      amount_inr: '199',
      category: 'Entertainment',
    })

    expect(result).toEqual({ ok: true, id: 'exp_1' })
    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        item: 'Netflix',
        amount_inr: '199',
        category: 'Entertainment',
        notes: 'Auto-added from subscription',
        source: 'subscription',
        payment_method: 'bank',
      }),
    )
    expect(notifyThresholdCrossed).toHaveBeenCalledWith(auth, 'Entertainment')
  })

  it('appends the subscription notes after the auto-generated marker', async () => {
    await applySubscriptionExpense(auth, {
      service: 'Netflix',
      amount_inr: '199',
      category: 'Entertainment',
      notes: 'shared with family',
    })

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Auto-added from subscription · shared with family' }),
    )
  })
})
