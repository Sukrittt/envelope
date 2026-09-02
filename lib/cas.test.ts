import { describe, it, expect, vi } from 'vitest'
import { casRetry } from './cas'

describe('casRetry', () => {
  it('succeeds on the first attempt without retrying', async () => {
    const step = vi.fn(async () => 'ok' as const)
    await expect(casRetry(step)).resolves.toBe('ok')
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('retries after a lost race and succeeds once the guard matches', async () => {
    const step = vi
      .fn<() => Promise<'ok' | 'retry'>>()
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('retry')
      .mockResolvedValueOnce('ok')
    await expect(casRetry(step)).resolves.toBe('ok')
    expect(step).toHaveBeenCalledTimes(3)
  })

  it('throws once maxAttempts is exceeded', async () => {
    const step = vi.fn(async () => 'retry' as const)
    await expect(casRetry(step, 3)).rejects.toThrow(/too much write contention/)
    expect(step).toHaveBeenCalledTimes(3)
  })

  it('returns a terminal non-retry value (e.g. a not-found result) without retrying', async () => {
    const step = vi.fn(async () => ({ ok: false, error: 'not found' }) as const)
    await expect(casRetry(step)).resolves.toEqual({ ok: false, error: 'not found' })
    expect(step).toHaveBeenCalledTimes(1)
  })
})
