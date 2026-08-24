import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
}))

const deleteManyMock = vi.fn(async () => ({ deletedCount: 0 }))
vi.mock('@/lib/scoped', () => ({
  scoped: vi.fn(() => ({ deleteMany: deleteManyMock })),
}))

const deleteUserMock = vi.fn(async () => undefined)
vi.mock('@/lib/workosClient', () => ({
  getWorkOSClient: vi.fn(() => ({ userManagement: { deleteUser: deleteUserMock } })),
}))

const usersDeleteOneMock = vi.fn(async () => ({ deletedCount: 1 }))
const usersFindOneMock = vi.fn(async () => ({ email: 'real-owner@example.com' }))

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({
      findOne: usersFindOneMock,
      deleteOne: usersDeleteOneMock,
    })),
  })),
}))

const { DELETE } = await import('./route')

function deleteRequest(body: unknown): Request {
  return new Request('https://example.com/api/user', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  usersFindOneMock.mockResolvedValue({ email: 'real-owner@example.com' })
})

describe('DELETE /api/user', () => {
  it('rejects when no email is supplied', async () => {
    const res = await DELETE(deleteRequest({}))
    expect(res.status).toBe(400)
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('rejects when the supplied email does not match the account on file', async () => {
    const res = await DELETE(deleteRequest({ email: 'attacker@example.com' }))
    expect(res.status).toBe(400)
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(usersDeleteOneMock).not.toHaveBeenCalled()
  })

  it('proceeds when the supplied email matches, case-insensitively', async () => {
    const res = await DELETE(deleteRequest({ email: 'Real-Owner@Example.com' }))
    expect(res.status).toBe(200)
    expect(deleteUserMock).toHaveBeenCalledWith('user_a')
    expect(usersDeleteOneMock).toHaveBeenCalled()
  })

  it('no longer accepts the old confirm:true shortcut without an email', async () => {
    const res = await DELETE(deleteRequest({ confirm: true }))
    expect(res.status).toBe(400)
    expect(deleteUserMock).not.toHaveBeenCalled()
  })
})
