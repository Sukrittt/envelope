import { describe, it, expect, vi, beforeEach } from 'vitest'

const hits: { key: string; ts: Date }[] = []

vi.mock('./mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({
      countDocuments: vi.fn(async (filter: { key: string; ts: { $gte: Date } }) =>
        hits.filter((h) => h.key === filter.key && h.ts >= filter.ts.$gte).length,
      ),
      insertOne: vi.fn(async (doc: { key: string; ts: Date }) => {
        hits.push(doc)
        return { insertedId: hits.length }
      }),
    })),
  })),
}))

const { isRateLimited } = await import('./rateLimit')

beforeEach(() => {
  hits.length = 0
})

describe('isRateLimited', () => {
  it('allows requests under the limit', async () => {
    expect(await isRateLimited('user_a', { windowMs: 60_000, limit: 3 })).toBe(false)
    expect(await isRateLimited('user_a', { windowMs: 60_000, limit: 3 })).toBe(false)
    expect(await isRateLimited('user_a', { windowMs: 60_000, limit: 3 })).toBe(false)
  })

  it('blocks once the limit is reached', async () => {
    await isRateLimited('user_a', { windowMs: 60_000, limit: 2 })
    await isRateLimited('user_a', { windowMs: 60_000, limit: 2 })
    expect(await isRateLimited('user_a', { windowMs: 60_000, limit: 2 })).toBe(true)
  })

  it('keeps separate keys independent', async () => {
    await isRateLimited('user_a', { windowMs: 60_000, limit: 1 })
    expect(await isRateLimited('user_b', { windowMs: 60_000, limit: 1 })).toBe(false)
  })

  it('does not count hits outside the window', async () => {
    hits.push({ key: 'user_a', ts: new Date(Date.now() - 120_000) })
    expect(await isRateLimited('user_a', { windowMs: 60_000, limit: 1 })).toBe(false)
  })
})
