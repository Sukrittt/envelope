import { describe, it, expect, vi, beforeEach } from 'vitest'

const deleteUserMock = vi.fn()
const deleteManyMock = vi.fn(async () => ({ deletedCount: 2 }))
const deleteOneMock = vi.fn(async () => ({ deletedCount: 1 }))

vi.mock('./workosClient', () => ({ getWorkOSClient: () => ({ userManagement: { deleteUser: deleteUserMock } }) }))
vi.mock('@vercel/blob', () => ({ list: vi.fn(), del: vi.fn() }))

const { purgeAccountNow } = await import('./accountLifecycle')
const db = { collection: () => ({ deleteMany: deleteManyMock, deleteOne: deleteOneMock }) } as never

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.BLOB_READ_WRITE_TOKEN
})

describe('purgeAccountNow', () => {
  it('keeps local data when WorkOS deletion fails', async () => {
    deleteUserMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
    await expect(purgeAccountNow(db, 'user_1')).rejects.toThrow('boom')
    expect(deleteManyMock).not.toHaveBeenCalled()
    expect(deleteOneMock).not.toHaveBeenCalled()
  })

  it('continues when the WorkOS user is already gone', async () => {
    deleteUserMock.mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
    const result = await purgeAccountNow(db, 'user_1')
    expect(deleteManyMock).toHaveBeenCalledWith({ user_id: 'user_1' })
    expect(deleteOneMock).toHaveBeenCalledWith({ _id: 'user_1' })
    expect(result.rows).toBeGreaterThan(0)
  })
})
