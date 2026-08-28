import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER: { _id: string; notifyCadence?: string; notifyThresholds?: boolean } = { _id: 'user_a', notifyCadence: 'weekly' }

const usersFindOneMock = vi.fn(async () => USER)
const logInsertOneMock = vi.fn(async () => ({ insertedId: 'x' }))

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: (name: string) => {
      if (name === 'users') return { findOne: usersFindOneMock }
      if (name === 'notification_log') return { insertOne: logInsertOneMock }
      throw new Error(`unexpected collection: ${name}`)
    },
  })),
}))

const sendPushNotificationMock = vi.fn(async (_args: { userId: string; title: string; body: string; data?: unknown }) => {})
vi.mock('@/lib/push', () => ({ sendPushNotification: sendPushNotificationMock }))

const buildExpenseContextMock = vi.fn(async () => ({
  facts: 'FACTS',
  meta: { txnCountThisMonth: 1, totalSpent: 900, totalAssigned: 1000, daysLeft: 5, daysElapsed: 25, totalDaysInMonth: 30 },
  envelopes: [
    { category: 'Food', group: '', assigned: 1000, spent: 900, available: 100, rolledOver: 0, isOverspent: false, spentPct: 90 },
    { category: 'Travel', group: '', assigned: 1000, spent: 100, available: 900, rolledOver: 0, isOverspent: false, spentPct: 10 },
  ],
  subscriptions: [],
  categories: [] as { name: string; alertPcts?: number[] }[],
}))
vi.mock('@/lib/ai/expenseContext', () => ({ buildExpenseContext: buildExpenseContextMock }))

const { notifyThresholdCrossed } = await import('./instant')

describe('notifyThresholdCrossed', () => {
  beforeEach(() => {
    usersFindOneMock.mockReset().mockResolvedValue(USER)
    logInsertOneMock.mockReset().mockResolvedValue({ insertedId: 'x' })
    sendPushNotificationMock.mockReset().mockResolvedValue(undefined)
    buildExpenseContextMock.mockClear()
  })

  it('sends a push for the category that just crossed its threshold', async () => {
    // Food is at 90% with no alertPcts of its own, so it falls back to the
    // default set [50, 90, 100]; 50 and 90 are both crossed, but only the
    // highest sends.
    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food')
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendPushNotificationMock.mock.calls[0][0]).toMatchObject({ userId: 'user_a' })
  })

  it('does not fire for a category that did not cross, even if another did', async () => {
    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Travel')
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('does nothing when category limit alerts are off', async () => {
    usersFindOneMock.mockResolvedValue({ _id: 'user_a', notifyThresholds: false })
    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food')
    expect(buildExpenseContextMock).not.toHaveBeenCalled()
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('still fires when the digest cadence is off, since thresholds are independent', async () => {
    usersFindOneMock.mockResolvedValue({ _id: 'user_a', notifyCadence: 'off' })
    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food')
    expect(sendPushNotificationMock).toHaveBeenCalled()
  })

  it("sends a single push when several of a category's triggers are crossed at once", async () => {
    buildExpenseContextMock.mockResolvedValueOnce({
      facts: 'FACTS',
      meta: { txnCountThisMonth: 1, totalSpent: 950, totalAssigned: 1000, daysLeft: 5, daysElapsed: 25, totalDaysInMonth: 30 },
      envelopes: [
        { category: 'Food', group: '', assigned: 1000, spent: 950, available: 50, rolledOver: 0, isOverspent: false, spentPct: 95 },
      ],
      subscriptions: [],
      categories: [{ name: 'Food', alertPcts: [50, 90, 100] }],
    })
    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food')
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1)
  })

  it('does not re-send once the key is already claimed', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    logInsertOneMock.mockRejectedValue(duplicateKeyError)

    await notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food')
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('swallows errors rather than throwing, since it must never break the expense write', async () => {
    usersFindOneMock.mockRejectedValue(new Error('mongo down'))
    await expect(
      notifyThresholdCrossed({ userId: 'user_a', readOnly: false, sessionId: null }, 'Food'),
    ).resolves.toBeUndefined()
  })
})
