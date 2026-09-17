import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertOneMock = vi.fn(async () => ({}))
vi.mock('./mongodb', () => ({ getDb: vi.fn(async () => ({ collection: () => ({ insertOne: insertOneMock }) })) }))

const { recordCronRun, triggerOf } = await import('./cronRuns')

beforeEach(() => vi.clearAllMocks())

describe('recordCronRun', () => {
  it('records a successful run and returns its result', async () => {
    expect(await recordCronRun('gc', 'cron', async () => ({ purged: 2 }))).toEqual({ purged: 2 })
    expect(insertOneMock).toHaveBeenCalledWith(expect.objectContaining({ job: 'gc', trigger: 'cron', ok: true, result: { purged: 2 }, error: null }))
  })

  it('records a failure and rethrows', async () => {
    await expect(recordCronRun('gc', 'admin', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(insertOneMock).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: 'boom', trigger: 'admin' }))
  })

  it('still returns the result when recording fails', async () => {
    insertOneMock.mockRejectedValueOnce(new Error('db down'))
    expect(await recordCronRun('gc', 'cron', async () => ({ purged: 0 }))).toEqual({ purged: 0 })
  })
})

describe('triggerOf', () => {
  it('defaults to cron', () => {
    expect(triggerOf(new Request('https://x'))).toBe('cron')
    expect(triggerOf(new Request('https://x', { headers: { 'x-aviary-trigger': 'admin' } }))).toBe('admin')
  })
})
