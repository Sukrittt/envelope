import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// lib/access.ts imports @workos-inc/authkit-nextjs at module scope for
// withAuth(), which in turn pulls in next/cache — unavailable outside the
// Next.js runtime, and irrelevant to demoUserId() itself.
vi.mock('@workos-inc/authkit-nextjs', () => ({ withAuth: vi.fn() }))

const ORIGINAL_DEMO_USER_ID = process.env.DEMO_USER_ID

beforeEach(() => {
  delete process.env.DEMO_USER_ID
})

afterEach(() => {
  vi.unstubAllEnvs()
  if (ORIGINAL_DEMO_USER_ID !== undefined) process.env.DEMO_USER_ID = ORIGINAL_DEMO_USER_ID
})

describe('demoUserId', () => {
  it('returns DEMO_USER_ID when set', async () => {
    process.env.DEMO_USER_ID = 'demo_custom'
    const { demoUserId } = await import('./access')
    expect(demoUserId()).toBe('demo_custom')
  })

  it('falls back to "demo" outside production when unset', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const { demoUserId } = await import('./access')
    expect(demoUserId()).toBe('demo')
  })

  it('throws in production when unset, instead of silently using a guessable id', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const { demoUserId } = await import('./access')
    expect(() => demoUserId()).toThrow(/DEMO_USER_ID/)
  })
})
