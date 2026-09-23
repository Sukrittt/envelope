import { beforeEach, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'

const mocks = vi.hoisted(() => ({
  accepted: vi.fn(),
  suggestion: vi.fn(),
  recurring: vi.fn(),
  duplicate: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/access', () => ({ getAuth: async () => ({ userId: 'u', readOnly: false }), readOnlyGuard: () => null }))
vi.mock('@/lib/billing/guard', () => ({ requireAccess: async () => null }))
vi.mock('@/lib/cache', () => ({ invalidate: vi.fn() }))
vi.mock('@/lib/userCurrency', () => ({ nowForUser: async () => ({ date: '2026-09-22', timestamp: '2026-09-22T10:00:00Z' }) }))
vi.mock('@/lib/http', async original => ({
  ...await original<typeof import('@/lib/http')>(),
  getCollection: async (name: string) => {
    if (name === 'recurring_detection') return { findOne: mocks.suggestion }
    if (name === 'recurring_expenses') return { find: () => ({ toArray: mocks.recurring }) }
    return {
      findOne: (filter: Record<string, unknown>) => ('_id' in filter ? mocks.accepted(filter) : mocks.duplicate(filter)),
      insertOne: mocks.insert,
      updateOne: mocks.update,
    }
  },
}))

import { POST } from './route'

const id = new ObjectId().toHexString()
const fields = {
  suggestion_id: id,
  service: 'Netflix',
  amount_inr: '649',
  billing_cycle: 'monthly',
  next_due_date: '2026-10-05',
  category: 'Entertainment',
}
const request = (changes = {}) => new Request('https://example.com/api/subscriptions', {
  method: 'POST',
  body: JSON.stringify({ ...fields, ...changes }),
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.accepted.mockResolvedValue(null)
  mocks.duplicate.mockResolvedValue(null)
  mocks.suggestion.mockResolvedValue({ decision: { pattern: 'subscription', frequency: 'monthly' } })
  mocks.recurring.mockResolvedValue([])
  mocks.insert.mockResolvedValue({ insertedId: new ObjectId(id) })
  mocks.update.mockResolvedValue({ matchedCount: 1 })
})

it('stores a subscription suggestion under a stable id', async () => {
  expect((await POST(request())).status).toBe(200)
  const doc = mocks.insert.mock.calls[0][0]
  expect(String(doc._id)).toBe(id)
  expect(doc.suggestion_id).toBe(id)
})

it('is idempotent when confirmation is retried', async () => {
  mocks.accepted.mockResolvedValue({ _id: new ObjectId(id) })
  expect((await POST(request())).status).toBe(200)
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('reactivates a cancelled subscription when its new pattern is accepted', async () => {
  const existingId = new ObjectId()
  mocks.duplicate.mockResolvedValue({ _id: existingId, service: 'Netflix', status: 'cancelled' })
  expect((await POST(request())).status).toBe(200)
  expect(mocks.update).toHaveBeenCalledWith(
    { _id: existingId },
    { $set: expect.objectContaining({ status: 'active', suggestion_id: id, amount_inr: '649', billing_cycle: 'monthly' }) },
  )
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('rejects recurring decisions, dismissed suggestions, and non-future due dates', async () => {
  mocks.suggestion.mockResolvedValue({ decision: { pattern: 'other_recurring', frequency: 'monthly' } })
  expect((await POST(request())).status).toBe(409)
  mocks.suggestion.mockResolvedValue({ decision: { pattern: 'subscription', frequency: 'monthly' }, dismissed: true })
  expect((await POST(request())).status).toBe(409)
  mocks.suggestion.mockResolvedValue({ decision: { pattern: 'subscription', frequency: 'monthly' } })
  expect((await POST(request({ next_due_date: '2026-09-22' }))).status).toBe(400)
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('rejects a payment already tracked as a recurring expense', async () => {
  mocks.recurring.mockResolvedValue([{ item: ' NETFLIX ' }])
  expect((await POST(request())).status).toBe(409)
  expect(mocks.insert).not.toHaveBeenCalled()
})

it('does not turn an archived id collision into a successful retry', async () => {
  mocks.insert.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }))
  expect((await POST(request())).status).toBe(409)
})
