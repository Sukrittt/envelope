import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({
  invalidate: vi.fn(),
}))

const insertOneMock = vi.fn()
vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => ({ insertOne: insertOneMock })),
  }
})

const { POST } = await import('./route')

function req(body: unknown): Request {
  return new Request('https://example.com/api/budgets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/budgets (C4)', () => {
  it('returns 409, not a raw 500, when the unique index rejects a duplicate month/category', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    insertOneMock.mockRejectedValueOnce(duplicateKeyError)

    const res = await POST(req({ month: '2026-01', category: 'Groceries', assigned: '5000' }))
    expect(res.status).toBe(409)
  })

  it('re-throws a non-duplicate-key error instead of masking it as a conflict', async () => {
    insertOneMock.mockRejectedValueOnce(new Error('connection reset'))
    await expect(POST(req({ month: '2026-01', category: 'Groceries', assigned: '5000' }))).rejects.toThrow(
      'connection reset',
    )
  })

  it('succeeds normally when there is no conflict', async () => {
    insertOneMock.mockResolvedValueOnce({ insertedId: '1' })
    const res = await POST(req({ month: '2026-01', category: 'Groceries', assigned: '5000' }))
    expect(res.status).toBe(200)
  })
})
