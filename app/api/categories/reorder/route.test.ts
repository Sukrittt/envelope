import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

const invalidateMock = vi.fn()
vi.mock('@/lib/cache', () => ({ invalidate: invalidateMock }))

const docs = [
  { name: 'Rent', group: 'Home', order: 0 },
  { name: 'Groceries', group: 'Home', order: 1 },
]

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected && typeof expected === 'object') {
    const cond = expected as { $lt?: number; $gt?: number }
    if (cond.$lt !== undefined) return typeof actual === 'number' && actual < cond.$lt
    if (cond.$gt !== undefined) return typeof actual === 'number' && actual > cond.$gt
  }
  return actual === expected
}

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => ({
      findOne: async (filter: Record<string, unknown>) =>
        docs.find((d) => Object.entries(filter).every(([k, v]) => matchValue((d as Record<string, unknown>)[k], v))) ??
        null,
      updateOne: vi.fn(async (filter: { name: string }, update: { $set: { order: number } }) => {
        const doc = docs.find((d) => d.name === filter.name)
        if (doc) doc.order = update.$set.order
        return {}
      }),
    })),
  }
})

const { POST } = await import('./route')

describe('POST /api/categories/reorder (C3)', () => {
  it('invalidates the categories cache after swapping order', async () => {
    const res = await POST(
      new Request('https://example.com/api/categories/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Rent', direction: 'down' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(invalidateMock).toHaveBeenCalledWith('categories', 'user_a')
  })
})
