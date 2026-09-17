import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAdminMock = vi.fn(async () => 'admin_1')
const findOneMock = vi.fn()
const purgeMock = vi.fn(async () => ({ rows: 3, blobs: 1 }))
const softDeleteMock = vi.fn(async () => 'ts')
const auditMock = vi.fn(async () => undefined)
const redirectMock = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }))
vi.mock('@/lib/admin', () => ({ requireAdmin: () => requireAdminMock() }))
vi.mock('@/lib/adminAudit', () => ({ audit: (...args: unknown[]) => auditMock(...(args as [])) }))
vi.mock('@/lib/workosClient', () => ({ getWorkOSClient: vi.fn() }))
vi.mock('@/lib/accountLifecycle', () => ({
  purgeAccountNow: (...args: unknown[]) => purgeMock(...(args as [])),
  softDeleteAccount: (...args: unknown[]) => softDeleteMock(...(args as [])),
  restoreAccount: vi.fn(),
}))
vi.mock('@/lib/mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ findOne: findOneMock }) })) }))

const { hardDeleteAction, softDeleteAction } = await import('./actions')

const form = (email: string) => {
  const f = new FormData()
  f.set('confirmEmail', email)
  return f
}

beforeEach(() => {
  vi.clearAllMocks()
  findOneMock.mockResolvedValue({ _id: 'user_2', email: 'Victim@Example.com' })
})

describe('hardDeleteAction', () => {
  it('refuses when the typed email does not match', async () => {
    expect(await hardDeleteAction('user_2', null, form('someone@else.com'))).toEqual({ ok: false, message: 'Typed email does not match' })
    expect(purgeMock).not.toHaveBeenCalled()
  })

  it("refuses the admin's own account", async () => {
    expect((await hardDeleteAction('admin_1', null, form('x')))?.ok).toBe(false)
    expect(purgeMock).not.toHaveBeenCalled()
  })

  it('purges, audits and redirects on a case-insensitive email match', async () => {
    await hardDeleteAction('user_2', null, form(' victim@example.com '))
    expect(purgeMock).toHaveBeenCalledWith(expect.anything(), 'user_2')
    expect(auditMock).toHaveBeenCalledWith('admin_1', 'user.hard_delete', 'user_2', { email: 'Victim@Example.com', rows: 3, blobs: 1 })
    expect(redirectMock).toHaveBeenCalledWith('/admin/users')
  })

  it('does nothing when requireAdmin rejects', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'))
    await expect(hardDeleteAction('user_2', null, form('victim@example.com'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(purgeMock).not.toHaveBeenCalled()
  })
})

describe('softDeleteAction', () => {
  it('skips an account already scheduled for deletion', async () => {
    findOneMock.mockResolvedValue({ _id: 'user_2', email: 'v@e.com', deleted_at: '2026-01-01' })
    expect((await softDeleteAction('user_2'))?.ok).toBe(false)
    expect(softDeleteMock).not.toHaveBeenCalled()
  })
})
