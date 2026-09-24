import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/access', () => ({ getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })) }))
vi.mock('@/lib/billing/guard', () => ({ requireAccess: vi.fn(async () => null) }))
vi.mock('@/lib/userCurrency', () => ({ nowForUser: vi.fn(async () => ({ date: '2026-09-24' })) }))
vi.mock('@/lib/wrapped', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wrapped')>()),
  readRecap: vi.fn(async () => ({ totalTransactions: 20 })),
}))

type CacheArgs = [base: string, userId: string, fn: () => Promise<unknown>, keySuffix?: string]
const cachedRead = vi.fn((...args: CacheArgs) => args[2]())
vi.mock('@/lib/cache', () => ({ cachedRead: (...args: unknown[]) => cachedRead(...(args as CacheArgs)) }))

const judgeWrapped = vi.fn()
vi.mock('@/lib/ai/wrappedPersona', () => ({ judgeWrapped: (...args: unknown[]) => judgeWrapped(...(args as [])) }))

const { GET } = await import('./route')
const request = () => new Request('https://example.com/api/wrapped/judgement')

beforeEach(() => vi.clearAllMocks())

describe('GET /api/wrapped/judgement', () => {
  it('caches under its own base, so an expense write does not re-run Jev', async () => {
    judgeWrapped.mockResolvedValue({ persona: 'loyalist', treatCategory: 'Food' })
    const res = await GET(request())
    expect(await res.json()).toEqual({ persona: 'loyalist', treatCategory: 'Food' })
    // Not 'wrapped': invalidate('wrapped', ...) runs on every expense write.
    expect(cachedRead.mock.calls[0][0]).toBe('wrapped-judgement')
    expect(cachedRead.mock.calls[0][3]).toBe('2026-08')
  })

  it('does not cache an empty judgement, so an outage is retried next visit', async () => {
    judgeWrapped.mockResolvedValue({ persona: null, treatCategory: null })
    const res = await GET(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ persona: null, treatCategory: null })
    await expect(cachedRead.mock.results[0].value).rejects.toThrow()
  })
})
