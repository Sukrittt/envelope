import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
}))

let lastPipeline: unknown[] = []

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => ({
      aggregate: (pipeline: unknown[]) => {
        lastPipeline = pipeline
        return { toArray: async () => [{ data: [], totalCount: [{ count: 0 }] }] }
      },
    })),
  }
})

const { GET } = await import('./route')

function findLimitStage(pipeline: unknown[]): number | undefined {
  const facet = pipeline.find((s): s is { $facet: { data: unknown[] } } => Boolean((s as { $facet?: unknown }).$facet))
  const limitStage = facet?.$facet.data.find((s): s is { $limit: number } => Boolean((s as { $limit?: number }).$limit))
  return limitStage?.$limit
}

describe('GET /api/ai/chat/sessions', () => {
  it('clamps an oversized ?limit= to the server-side max', async () => {
    await GET(new Request('https://example.com/api/ai/chat/sessions?limit=100000000'))
    expect(findLimitStage(lastPipeline)).toBe(100)
  })

  it('falls back to the default limit for a non-numeric value', async () => {
    await GET(new Request('https://example.com/api/ai/chat/sessions?limit=abc'))
    expect(findLimitStage(lastPipeline)).toBe(10)
  })

  it('floors a fractional limit instead of feeding it straight to Mongo', async () => {
    await GET(new Request('https://example.com/api/ai/chat/sessions?limit=1.5'))
    expect(findLimitStage(lastPipeline)).toBe(1)
  })

  it('accepts a normal in-range limit unchanged', async () => {
    await GET(new Request('https://example.com/api/ai/chat/sessions?limit=25'))
    expect(findLimitStage(lastPipeline)).toBe(25)
  })
})
