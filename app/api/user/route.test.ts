import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
}))

const deleteManyMock = vi.fn(async () => ({ deletedCount: 0 }))
vi.mock('@/lib/scoped', () => ({
  scoped: vi.fn(() => ({ deleteMany: deleteManyMock })),
}))

const deleteUserMock = vi.fn(async () => undefined)
const updateUserMock = vi.fn(async () => undefined)
vi.mock('@/lib/workosClient', () => ({
  getWorkOSClient: vi.fn(() => ({ userManagement: { deleteUser: deleteUserMock, updateUser: updateUserMock } })),
}))

const usersDeleteOneMock = vi.fn(async () => ({ deletedCount: 1 }))
const usersFindOneMock = vi.fn(async () => ({ email: 'real-owner@example.com' }))
const usersUpdateOneMock = vi.fn(async () => ({ modifiedCount: 1 }))

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({
    collection: vi.fn(() => ({
      findOne: usersFindOneMock,
      deleteOne: usersDeleteOneMock,
      updateOne: usersUpdateOneMock,
    })),
  })),
}))

const { DELETE, PATCH } = await import('./route')

function patchRequest(body: unknown): Request {
  return new Request('https://example.com/api/user', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

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

describe('PATCH /api/user', () => {
  it('accepts notifyWrapped and writes it through the allowlist', async () => {
    const res = await PATCH(patchRequest({ notifyWrapped: false }))
    expect(res.status).toBe(200)
    expect(usersUpdateOneMock).toHaveBeenCalledWith({ _id: 'user_a' }, { $set: { notifyWrapped: false } })
  })

  it('drops a non-boolean notifyWrapped instead of writing it', async () => {
    const res = await PATCH(patchRequest({ notifyWrapped: 'yes' }))
    expect(res.status).toBe(400)
    expect(usersUpdateOneMock).not.toHaveBeenCalled()
  })
})
