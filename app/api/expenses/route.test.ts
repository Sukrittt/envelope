import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({
  cachedRead: vi.fn(async (_base: string, _userId: string, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(),
}))

type Doc = Record<string, unknown> & { _id: ObjectId }

const stores: Record<string, Doc[]> = { expenses: [], budgets: [] }

/** Matches a filter against a doc, comparing `_id` by value (ObjectId has no useful `===`). */
function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) =>
    k === '_id' && v instanceof ObjectId ? doc._id.equals(v) : doc[k] === v,
  )
}

function fakeCollection(base: string) {
  const store = stores[base]
  return {
    find: (filter: Record<string, unknown> = {}) => ({
      sort: () => ({
        toArray: async () => store.filter((d) => matches(d, filter)),
      }),
      toArray: async () => store.filter((d) => matches(d, filter)),
    }),
    findOne: async (filter: Record<string, unknown>) => store.find((d) => matches(d, filter)) ?? null,
    insertOne: async (doc: Record<string, unknown>) => {
      const withId = { ...doc, _id: new ObjectId() } as Doc
      store.push(withId)
      return { insertedId: withId._id }
    },
    updateOne: async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const doc = store.find((d) => matches(d, filter))
      if (doc) Object.assign(doc, update.$set)
      return { matchedCount: doc ? 1 : 0 }
    },
    deleteOne: async (filter: Record<string, unknown>) => {
      const idx = store.findIndex((d) => matches(d, filter))
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

const { GET, POST, PUT, DELETE } = await import('./route')

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

  it('updates notes and payment method, unwinding and reapplying the CC envelope on a bank<->credit_card switch', async () => {
    await POST(
      req('POST', {
        item: 'Taxi',
        amount_inr: '400',
        category: 'Transport',
        date: '2026-07-01',
        timestamp: '2026-07-01T10:00:00',
        payment_method: 'bank',
      }),
    )
    expect(stores.budgets).toHaveLength(0)

    // Switch to credit_card: envelope should pick it up.
    let res = await PUT(
      req('PUT', {
        timestamp: '2026-07-01T10:00:00',
        item: 'Taxi',
        amount_inr: '400',
        new_notes: 'Airport run',
        new_payment_method: 'credit_card',
      }),
    )
    expect(res.status).toBe(200)
    expect(stores.expenses[0].notes).toBe('Airport run')
    expect(stores.expenses[0].payment_method).toBe('credit_card')
    expect(budgetFor('2026-07')?.assigned).toBe('400')

    // Switch back to bank: envelope should unwind.
    res = await PUT(
      req('PUT', {
        timestamp: '2026-07-01T10:00:00',
        item: 'Taxi',
        amount_inr: '400',
        new_payment_method: 'bank',
      }),
    )
    expect(res.status).toBe(200)
    expect(budgetFor('2026-07')?.assigned).toBe('0')
  })
})

describe('GET/PUT/DELETE /api/expenses — id-based addressing (C2)', () => {
  it('GET includes a real id alongside the CSV-shaped fields', async () => {
    await POST(
      req('POST', { item: 'Coffee', amount_inr: '150', category: 'Food', date: '2026-06-01' }),
    )
    const res = await GET(new Request('https://example.com/api/expenses'))
    const body = (await res.json()) as { rows: Array<{ id: string; item: string }> }
    expect(body.rows).toHaveLength(1)
    expect(ObjectId.isValid(body.rows[0].id)).toBe(true)
    expect(body.rows[0].item).toBe('Coffee')
  })

  it('PUT updates by id even when two rows share the same timestamp/item/amount', async () => {
    await POST(req('POST', { item: 'Coffee', amount_inr: '150', category: 'Food', timestamp: 'dup', date: '2026-06-01' }))
    await POST(req('POST', { item: 'Coffee', amount_inr: '150', category: 'Food', timestamp: 'dup', date: '2026-06-01' }))
    const [first, second] = stores.expenses

    const res = await PUT(req('PUT', { id: second._id.toString(), category: 'Dining' }))
    expect(res.status).toBe(200)
    expect(first.category).toBe('Food')
    expect(second.category).toBe('Dining')
  })

  it('DELETE by id removes exactly that row', async () => {
    await POST(req('POST', { item: 'Coffee', amount_inr: '150', category: 'Food', date: '2026-06-01' }))
    const [row] = stores.expenses

    const res = await DELETE(req('DELETE', { id: row._id.toString() }))
    expect(res.status).toBe(200)
    expect(stores.expenses).toHaveLength(0)
  })

  it('still falls back to the timestamp/item/amount triple when no id is sent (old client compatibility)', async () => {
    await POST(req('POST', { item: 'Coffee', amount_inr: '150', category: 'Food', timestamp: 'ts-1', date: '2026-06-01' }))

    const res = await PUT(req('PUT', { timestamp: 'ts-1', item: 'Coffee', amount_inr: '150', category: 'Dining' }))
    expect(res.status).toBe(200)
    expect(stores.expenses[0].category).toBe('Dining')
  })

  it('rejects a malformed id instead of throwing', async () => {
    const res = await PUT(req('PUT', { id: 'not-an-object-id', category: 'X' }))
    expect(res.status).toBe(404)
  })
})
