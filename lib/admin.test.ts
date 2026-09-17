import { describe, it, expect, vi, beforeEach } from 'vitest'

const withAuthMock = vi.fn()
const findOneMock = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@workos-inc/authkit-nextjs', () => ({ withAuth: withAuthMock }))
vi.mock('./mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ findOne: findOneMock }) })) }))

const { adminUserId, requireAdmin } = await import('./admin')

beforeEach(() => vi.clearAllMocks())

describe('admin gate', () => {
  it('404s signed-out visitors without touching the DB', async () => {
    withAuthMock.mockResolvedValue({ user: null })
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(findOneMock).not.toHaveBeenCalled()
  })

  it('404s a signed-in user without isAdmin', async () => {
    withAuthMock.mockResolvedValue({ user: { id: 'user_1' } })
    findOneMock.mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND')
    expect(findOneMock).toHaveBeenCalledWith({ _id: 'user_1', isAdmin: true, deleted_at: null }, expect.anything())
  })

  it('returns the id for a live admin', async () => {
    withAuthMock.mockResolvedValue({ user: { id: 'user_1' } })
    findOneMock.mockResolvedValue({ _id: 'user_1' })
    expect(await requireAdmin()).toBe('user_1')
  })

  it('treats a withAuth failure as signed out', async () => {
    withAuthMock.mockRejectedValue(new Error('no request scope'))
    expect(await adminUserId()).toBeNull()
  })
})
