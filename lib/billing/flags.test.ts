import { describe, it, expect, vi, beforeEach } from 'vitest'

const settings = { billing: { enforced: true, purchaseEnabled: true, audience: 'testers' as 'testers' | 'everyone' } }
vi.mock('../systemSettings', () => ({ getSystemSettings: vi.fn(async () => settings) }))

const findOne = vi.fn()
vi.mock('../mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ findOne }) })) }))

const { billingFlagsFor } = await import('./flags')

const ON = { enforced: true, purchaseEnabled: true }
const OFF = { enforced: false, purchaseEnabled: false }

beforeEach(() => {
  vi.clearAllMocks()
  settings.billing = { enforced: true, purchaseEnabled: true, audience: 'testers' }
})

describe('billingFlagsFor', () => {
  it('keeps real users on the pre-launch behaviour while the audience is testers', async () => {
    findOne.mockResolvedValue(null)
    expect(await billingFlagsFor('user_real')).toEqual(OFF)
    expect(findOne).toHaveBeenCalledWith({ _id: 'user_real', billingTester: true }, expect.anything())
  })

  it('applies the switches to a billing tester', async () => {
    findOne.mockResolvedValue({ _id: 'user_qa' })
    expect(await billingFlagsFor('user_qa')).toEqual(ON)
  })

  it('applies the switches to everyone once the audience is everyone, with no user lookup', async () => {
    settings.billing.audience = 'everyone'
    expect(await billingFlagsFor('user_real')).toEqual(ON)
    expect(findOne).not.toHaveBeenCalled()
  })

  it('costs no database read while both switches are off', async () => {
    settings.billing = { enforced: false, purchaseEnabled: false, audience: 'testers' }
    expect(await billingFlagsFor('user_qa')).toEqual(OFF)
    expect(findOne).not.toHaveBeenCalled()
  })
})
