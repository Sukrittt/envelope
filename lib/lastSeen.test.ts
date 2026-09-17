import { describe, it, expect, vi } from 'vitest'

const updateOneMock = vi.fn(async () => ({}))
vi.mock('./mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ updateOne: updateOneMock }) })) }))

const { touchLastSeen } = await import('./lastSeen')

describe('touchLastSeen', () => {
  it('writes once per user per hour', async () => {
    await touchLastSeen('user_a')
    await touchLastSeen('user_a')
    await touchLastSeen('user_b')
    expect(updateOneMock).toHaveBeenCalledTimes(2)
  })

  it('swallows DB errors', async () => {
    updateOneMock.mockRejectedValueOnce(new Error('down'))
    await expect(touchLastSeen('user_c')).resolves.toBeUndefined()
  })
})
