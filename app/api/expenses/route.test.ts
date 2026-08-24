import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({
  cachedRead: vi.fn(async (_base: string, _userId: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
}))

type Doc = Record<string, unknown> & { _id: number }

const stores: Record<string, Doc[]> = { expenses: [], budgets: [] }
let nextId = 1

function fakeCollection(base: string) {
  const store = stores[base]
  return {
    find: (filter: Record<string, unknown> = {}) => ({
      sort: () => ({
        toArray: async () => store.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v)),
      }),
      toArray: async () => store.filter((d) => Object.entries(filter).every(([k, v]) => d[k] === v)),
    }),
    findOne: async (filter: Record<string, unknown>) =>
      store.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v)) ?? null,
    insertOne: async (doc: Record<string, unknown>) => {
      const withId = { ...doc, _id: nextId++ } as Doc
      store.push(withId)
      return { insertedId: withId._id }
    },
    updateOne: async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const doc = store.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v))
      if (doc) Object.assign(doc, update.$set)
      return { matchedCount: doc ? 1 : 0 }
    },
    deleteOne: async (filter: Record<string, unknown>) => {
      const idx = store.findIndex((d) => Object.entries(filter).every(([k, v]) => d[k] === v))
      if (idx >= 0) store.splice(idx, 1)
      return { deletedCount: idx >= 0 ? 1 : 0 }
    },
  }
}

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async (base: string) => fakeCollection(base)),
  }
})

const { POST, PUT } = await import('./route')

function req(method: string, body: unknown): Request {
  return new Request('https://example.com/api/expenses', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function budgetFor(month: string) {
  return stores.budgets.find((b) => b.month === month && b.category === '__credit_card__')
}

beforeEach(() => {
  stores.expenses = []
  stores.budgets = []
  nextId = 1
})

describe('PUT /api/expenses — credit-card envelope rebalance (C1)', () => {
  it('moves the envelope allocation when a CC expense changes month at the same amount', async () => {
    await POST(
      req('POST', {
        item: 'Flight',
        amount_inr: '3000',
        category: 'Travel',
        date: '2026-01-15',
        timestamp: '2026-01-15T10:00:00',
        payment_method: 'credit_card',
      }),
    )
    expect(budgetFor('2026-01')?.assigned).toBe('3000')
    expect(budgetFor('2026-02')).toBeUndefined()

    const res = await PUT(
      req('PUT', {
        timestamp: '2026-01-15T10:00:00',
        item: 'Flight',
        amount_inr: '3000',
        new_date: '2026-02-15',
      }),
    )
    expect(res.status).toBe(200)

    // Before the fix: the old month kept the charge and the new month never
    // got it, because the rebalance was gated on amount changing too.
    expect(budgetFor('2026-01')?.assigned).toBe('0')
    expect(budgetFor('2026-02')?.assigned).toBe('3000')
  })

  it('still rebalances correctly when only the amount changes within the same month', async () => {
    await POST(
      req('POST', {
        item: 'Groceries',
        amount_inr: '1000',
        category: 'Food',
        date: '2026-03-05',
        timestamp: '2026-03-05T10:00:00',
        payment_method: 'credit_card',
      }),
    )
    expect(budgetFor('2026-03')?.assigned).toBe('1000')

    await PUT(
      req('PUT', {
        timestamp: '2026-03-05T10:00:00',
        item: 'Groceries',
        amount_inr: '1000',
        new_amount_inr: '1500',
      }),
    )
    expect(budgetFor('2026-03')?.assigned).toBe('1500')
  })

  it('does not touch the credit-card envelope for a non-CC expense edit', async () => {
    await POST(
      req('POST', {
        item: 'Rent',
        amount_inr: '5000',
        category: 'Housing',
        date: '2026-04-01',
        timestamp: '2026-04-01T10:00:00',
        payment_method: 'bank',
      }),
    )
    expect(stores.budgets).toHaveLength(0)

    await PUT(
      req('PUT', {
        timestamp: '2026-04-01T10:00:00',
        item: 'Rent',
        amount_inr: '5000',
        new_date: '2026-05-01',
      }),
    )
    expect(stores.budgets).toHaveLength(0)
  })
})
