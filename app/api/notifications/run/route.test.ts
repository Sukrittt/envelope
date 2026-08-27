import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER: { _id: string; notifyCadence: string } = { _id: 'user_a', notifyCadence: 'weekly' }

const usersFindMock = vi.fn(() => ({ toArray: async () => [USER] }))
const logInsertOneMock = vi.fn(async () => ({ insertedId: 'x' }))

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: (name: string) => {
      if (name === 'users') return { find: usersFindMock }
      if (name === 'notification_log') return { insertOne: logInsertOneMock }
      throw new Error(`unexpected collection: ${name}`)
    },
  })),
}))

const sendPushNotificationMock = vi.fn(async () => {})
vi.mock('@/lib/push', () => ({
  sendPushNotification: sendPushNotificationMock,
}))

vi.mock('@/lib/ai/gemini', () => ({
  generateJSON: vi.fn(async () => ({ title: 'AI title', body: 'AI body' })),
}))

const buildExpenseContextMock = vi.fn(async () => ({
  facts: 'FACTS',
  meta: { txnCountThisMonth: 1, totalSpent: 900, totalAssigned: 1000, daysLeft: 5, daysElapsed: 25, totalDaysInMonth: 30 },
  envelopes: [
    {
      category: 'Food',
      group: '',
      assigned: 1000,
      spent: 900,
      available: 100,
      rolledOver: 0,
      isOverspent: false,
      spentPct: 90,
    },
  ],
  subscriptions: [],
  categories: [],
}))
vi.mock('@/lib/ai/expenseContext', () => ({
  buildExpenseContext: buildExpenseContextMock,
}))

const { GET } = await import('./route')

function req(bearer?: string): Request {
  const headers: Record<string, string> = {}
  if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`
  return new Request('https://example.com/api/notifications/run', { headers })
}

describe('GET /api/notifications/run', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
    logInsertOneMock.mockReset().mockResolvedValue({ insertedId: 'x' })
    sendPushNotificationMock.mockReset().mockResolvedValue(undefined)
    usersFindMock.mockReset().mockReturnValue({ toArray: async () => [USER] })
    buildExpenseContextMock.mockClear()
  })

  it('rejects a request with no bearer token', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('sends notifications and claims each key in the send log', async () => {
    const res = await GET(req('test-secret'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.sent).toBeGreaterThan(0)
    expect(sendPushNotificationMock).toHaveBeenCalled()
    expect(logInsertOneMock).toHaveBeenCalled()
  })

  it('does not re-send a notification whose key is already claimed', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 })
    logInsertOneMock.mockRejectedValue(duplicateKeyError)

    const res = await GET(req('test-secret'))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(sendPushNotificationMock).not.toHaveBeenCalled()
  })

  it('skips users whose cadence is off', async () => {
    usersFindMock.mockReturnValue({ toArray: async () => [] })
    const res = await GET(req('test-secret'))
    const body = await res.json()
    expect(body.sent).toBe(0)
    expect(buildExpenseContextMock).not.toHaveBeenCalled()
  })
})
