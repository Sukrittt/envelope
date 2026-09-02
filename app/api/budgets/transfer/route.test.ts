import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({
  invalidate: vi.fn(),
}))

vi.mock('@/lib/mongodb', () => ({
  withTx: async (fn: (session: undefined) => Promise<unknown>) => fn(undefined),
}))

type Doc = Record<string, unknown> & { _id: number }

let store: Doc[] = []
let nextId = 1

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => doc[k] === v)
}

function fakeBudgets() {
  return {
    findOne: async (filter: Record<string, unknown>) => store.find((d) => matches(d, filter)) ?? null,
    insertOne: async (doc: Record<string, unknown>) => {
      const existing = store.find((d) => d.month === doc.month && d.category === doc.category)
      if (existing) {
        const err = new Error('duplicate key') as Error & { code: number }
        err.code = 11000
        throw err
      }
      const withId = { ...doc, _id: nextId++ } as Doc
      store.push(withId)
      return { insertedId: withId._id }
    },
    updateOne: async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const doc = store.find((d) => matches(d, filter))
      if (doc) Object.assign(doc, update.$set)
      return { matchedCount: doc ? 1 : 0 }
    },
  }
}

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => fakeBudgets()),
  }
})

const { POST } = await import('./route')

function req(body: unknown): Request {
  return new Request('https://example.com/api/budgets/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function row(month: string, category: string) {
  return store.find((d) => d.month === month && d.category === category)
}

beforeEach(() => {
  store = []
  nextId = 1
})

describe('POST /api/budgets/transfer', () => {
  it('moves money between two envelopes — debit and credit sum to zero', async () => {
    store.push({ _id: 0, month: '2026-03', category: 'Dining', assigned: '2000', rolled_over: '0' })
    store.push({ _id: 0 - 1, month: '2026-03', category: 'Travel', assigned: '500', rolled_over: '0' })

    const res = await POST(req({ month: '2026-03', to: 'Travel', from: 'Dining', amount: 300 }))
    expect(res.status).toBe(200)

    expect(row('2026-03', 'Dining')?.assigned).toBe('1700')
    expect(row('2026-03', 'Travel')?.assigned).toBe('800')
  })

  it('moving from Ready to Assign only credits the target, no source row touched', async () => {
    store.push({ _id: 1, month: '2026-03', category: 'Travel', assigned: '500', rolled_over: '0' })

    const res = await POST(req({ month: '2026-03', to: 'Travel', from: '__ready_to_assign__', amount: 300 }))
    expect(res.status).toBe(200)

    expect(row('2026-03', 'Travel')?.assigned).toBe('800')
    expect(store).toHaveLength(1)
  })

  it('creates a budget row for the target when it has no assignment yet', async () => {
    store.push({ _id: 1, month: '2026-03', category: 'Dining', assigned: '2000', rolled_over: '0' })

    const res = await POST(req({ month: '2026-03', to: 'NewCategory', from: 'Dining', amount: 100 }))
    expect(res.status).toBe(200)

    expect(row('2026-03', 'NewCategory')?.assigned).toBe('100')
  })

  it('supports a multi-source allocation, splitting the debit across sources', async () => {
    store.push({ _id: 1, month: '2026-03', category: 'Dining', assigned: '2000', rolled_over: '0' })
    store.push({ _id: 2, month: '2026-03', category: 'Shopping', assigned: '1000', rolled_over: '0' })
    store.push({ _id: 3, month: '2026-03', category: 'Travel', assigned: '500', rolled_over: '0' })

    const res = await POST(
      req({
        month: '2026-03',
        to: 'Travel',
        sources: [
          { category: 'Dining', amount: 300 },
          { category: 'Shopping', amount: 200 },
        ],
      }),
    )
    expect(res.status).toBe(200)

    expect(row('2026-03', 'Dining')?.assigned).toBe('1700')
    expect(row('2026-03', 'Shopping')?.assigned).toBe('800')
    expect(row('2026-03', 'Travel')?.assigned).toBe('1000')
  })

  it('rejects a non-positive amount', async () => {
    const res = await POST(req({ month: '2026-03', to: 'Travel', from: 'Dining', amount: 0 }))
    expect(res.status).toBe(400)
  })

  it('rejects transferring an envelope to itself', async () => {
    const res = await POST(req({ month: '2026-03', to: 'Travel', from: 'Travel', amount: 100 }))
    expect(res.status).toBe(400)
  })

  it('rejects transferring to Ready to Assign', async () => {
    const res = await POST(req({ month: '2026-03', to: '__ready_to_assign__', from: 'Travel', amount: 100 }))
    expect(res.status).toBe(400)
  })

  it('404s when a source has no budget row for that month', async () => {
    const res = await POST(req({ month: '2026-03', to: 'Travel', from: 'GhostCategory', amount: 100 }))
    expect(res.status).toBe(404)
    expect(row('2026-03', 'Travel')).toBeUndefined()
  })
})
