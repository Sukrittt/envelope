import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const requireAdminMock = vi.fn(async () => 'admin_1')
const findOneMock = vi.fn()
type Update = { $set: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
const updateOneMock = vi.fn(async (_filter: unknown, _update: Update) => ({ modifiedCount: 1 }))
const auditMock = vi.fn(async () => undefined)
const refreshMock = vi.fn()

// `addMonthsUtc` comes from lib/billing/lifecycle, which drags in the server-only WorkOS client.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/admin', () => ({ requireAdmin: () => requireAdminMock() }))
vi.mock('@/lib/adminAudit', () => ({ audit: (...args: unknown[]) => auditMock(...(args as [])) }))
vi.mock('@/lib/billing/service', () => ({ refreshFromProvider: (...args: unknown[]) => refreshMock(...(args as [])) }))
vi.mock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ findOne: findOneMock, updateOne: updateOneMock }) })) }))

const { extendTrialAction, grantGiftAction, revokeGiftAction, resyncAction } = await import('./actions')

const NOW = Date.now()
const DAY = 86400000
const form = (entries: Record<string, string | number>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, String(v))
  return f
}
const setAccount = (over: Record<string, unknown> = {}) => findOneMock.mockResolvedValue({ _id: 'user_2', trialEndsAt: new Date(NOW + 5 * DAY), ...over })
/** The `$set` of the last updateOne. */
const written = () => updateOneMock.mock.calls.at(-1)![1].$set

beforeEach(() => {
  vi.clearAllMocks()
  // The actions stamp their own `new Date()`; frozen so the expected dates are exact.
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  setAccount()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('extendTrialAction', () => {
  it.each([['0'], ['400'], ['7.5'], ['lots']])('refuses %s days', async (days) => {
    expect((await extendTrialAction('user_2', null, form({ days })))?.ok).toBe(false)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('refuses an account that has no trial clock yet', async () => {
    findOneMock.mockResolvedValue(null)
    expect((await extendTrialAction('user_2', null, form({ days: 14 })))?.ok).toBe(false)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('adds to a live trial and clears any pending deletion deadline', async () => {
    await extendTrialAction('user_2', null, form({ days: 10 }))
    expect(written()).toEqual({ trialEndsAt: new Date(NOW + 15 * DAY), retentionDeadline: null })
  })

  it('gives a lapsed trial the full days from now, not from when it ran out', async () => {
    setAccount({ trialEndsAt: new Date(NOW - 30 * DAY) })
    await extendTrialAction('user_2', null, form({ days: 10 }))
    expect(written().trialEndsAt).toEqual(new Date(NOW + 10 * DAY))
  })
})

describe('grantGiftAction', () => {
  it('insists on a reason, so the audit entry explains the gift', async () => {
    expect((await grantGiftAction('user_2', null, form({ months: 12, reason: '  ' })))?.ok).toBe(false)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('refuses a months value outside 1–120', async () => {
    expect((await grantGiftAction('user_2', null, form({ months: 0, reason: 'x' })))?.ok).toBe(false)
    expect((await grantGiftAction('user_2', null, form({ months: 121, reason: 'x' })))?.ok).toBe(false)
  })

  it('grants from today and records who gave it', async () => {
    await grantGiftAction('user_2', null, form({ months: 3, reason: 'early supporter' }))
    const { comp, retentionDeadline } = written()
    expect(comp).toMatchObject({ reason: 'early supporter', grantedBy: 'admin_1' })
    expect(comp.until.getTime()).toBeGreaterThan(NOW + 89 * DAY)
    expect(retentionDeadline).toBeNull()
    expect(auditMock).toHaveBeenCalledWith('admin_1', 'billing.gift_grant', 'user_2', expect.objectContaining({ months: 3, stacked: false }))
  })

  it('stacks onto a gift that is still running rather than shortening it', async () => {
    const until = new Date(NOW + 300 * DAY)
    setAccount({ comp: { until, reason: 'old', grantedBy: 'admin_1', grantedAt: new Date(NOW) } })
    await grantGiftAction('user_2', null, form({ months: 1, reason: 'more' }))
    expect(written().comp.until.getTime()).toBeGreaterThan(until.getTime())
    expect(auditMock).toHaveBeenCalledWith('admin_1', 'billing.gift_grant', 'user_2', expect.objectContaining({ stacked: true }))
  })
})

describe('revokeGiftAction', () => {
  it('refuses when there is no gift to revoke', async () => {
    expect((await revokeGiftAction('user_2'))?.ok).toBe(false)
    expect(updateOneMock).not.toHaveBeenCalled()
  })

  it('clears the grant', async () => {
    setAccount({ comp: { until: new Date(NOW + DAY), reason: 'x', grantedBy: 'admin_1', grantedAt: new Date(NOW) } })
    expect((await revokeGiftAction('user_2'))?.ok).toBe(true)
    expect(written()).toEqual({ comp: null })
  })
})

describe('resyncAction', () => {
  it('reports a provider outage without claiming anything changed', async () => {
    refreshMock.mockRejectedValue(new Error('RevenueCat responded 503'))
    const result = await resyncAction('user_2')
    expect(result?.ok).toBe(false)
    expect(result?.message).toContain('nothing changed')
    expect(auditMock).not.toHaveBeenCalled()
  })
})
