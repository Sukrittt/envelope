import { describe, it, expect, vi, beforeEach } from 'vitest'

const insertOneMock = vi.fn(async (_doc: Record<string, unknown>) => ({}))

type Row = Record<string, unknown>
/** Rows the fake db serves, by collection name. `cron_runs` writes still go through insertOneMock. */
const rows: Record<string, Row[]> = { cron_runs: [], users: [], notification_log: [] }

function fakeCollection(name: string) {
  const store = (rows[name] ??= [])
  return {
    insertOne: async (doc: Row) => {
      if (name === 'cron_runs') return insertOneMock(doc)
      // The claim log's unique index is what makes claim() idempotent.
      if (name === 'notification_log' && store.some((d) => d.user_id === doc.user_id && d.key === doc.key)) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 })
      }
      store.push(doc)
      return {}
    },
    deleteOne: async (filter: Row) => {
      const i = store.findIndex((d) => Object.entries(filter).every(([k, v]) => d[k] === v))
      if (i >= 0) store.splice(i, 1)
      return {}
    },
    find: (filter: Row = {}) => {
      let results = store.filter((d) => Object.entries(filter).every(([k, v]) => (v === null ? d[k] == null : d[k] === v)))
      const cursor = {
        sort: (spec: Record<string, 1 | -1>) => {
          const [[field, dir]] = Object.entries(spec)
          results = [...results].sort((a, b) => ((a[field] as number) < (b[field] as number) ? -1 : 1) * dir)
          return cursor
        },
        limit: (n: number) => {
          results = results.slice(0, n)
          return cursor
        },
        toArray: async () => results,
      }
      return cursor
    },
  }
}

vi.mock('./mongodb', () => ({ getDb: vi.fn(async () => ({ collection: (name: string) => fakeCollection(name) })) }))

const sendPushNotification = vi.fn(async () => {})
vi.mock('./push', () => ({
  sendPushNotification: (...args: unknown[]) => sendPushNotification(...(args as Parameters<typeof sendPushNotification>)),
}))

const { recordCronRun, triggerOf, alertAdminsOnRepeatFailure } = await import('./cronRuns')

beforeEach(() => {
  vi.clearAllMocks()
  rows.cron_runs = []
  rows.users = [{ _id: 'admin_a', isAdmin: true, deleted_at: null }]
  rows.notification_log = []
})

/** `startedAt` orders the run history; the newest row is the run that just finished. */
function run(startedAt: number, ok: boolean, result: Row | null = null): Row {
  return { job: 'billing', startedAt, ok, result, error: ok ? null : 'boom' }
}

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


describe('alertAdminsOnRepeatFailure', () => {
  const title = 'Billing reconciliation failing'

  it('stays quiet on a healthy run', async () => {
    rows.cron_runs.push(run(1, false), run(2, true))
    expect(await alertAdminsOnRepeatFailure('billing', title, null)).toBe(false)
    expect(sendPushNotification).not.toHaveBeenCalled()
  })

  it('stays quiet on the first bad run, so one provider blip does not page anyone', async () => {
    rows.cron_runs.push(run(1, true), run(2, false))
    expect(await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')).toBe(false)
    expect(sendPushNotification).not.toHaveBeenCalled()
  })

  it('pushes the admins when the previous run was bad too', async () => {
    rows.cron_runs.push(run(1, false), run(2, false))
    expect(await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')).toBe(true)
    expect(sendPushNotification).toHaveBeenCalledWith({
      userId: 'admin_a',
      title,
      body: 'Two runs in a row: run errored: boom. Check /admin/jobs.',
    })
  })

  it('treats a run that finished with failed accounts as bad', async () => {
    rows.cron_runs.push(run(1, true, { checked: 52, failed: 47 }), run(2, true, { checked: 52, failed: 47 }))
    expect(await alertAdminsOnRepeatFailure('billing', title, "47 of 52 accounts didn't re-verify")).toBe(true)
  })

  it('pushes once a day, however many times the job runs', async () => {
    rows.cron_runs.push(run(1, false), run(2, false))
    await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')
    await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')
    expect(sendPushNotification).toHaveBeenCalledTimes(1)
  })

  it('releases the claim when the push throws, so the next run retries it', async () => {
    rows.cron_runs.push(run(1, false), run(2, false))
    sendPushNotification.mockRejectedValueOnce(new Error('expo down'))

    expect(await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')).toBe(false)
    expect(rows.notification_log).toHaveLength(0)
    expect(await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')).toBe(true)
  })

  it('skips deleted admins and ordinary users', async () => {
    rows.users = [
      { _id: 'admin_gone', isAdmin: true, deleted_at: '2026-09-01T00:00:00Z' },
      { _id: 'user_b', deleted_at: null },
    ]
    rows.cron_runs.push(run(1, false), run(2, false))

    expect(await alertAdminsOnRepeatFailure('billing', title, 'run errored: boom')).toBe(false)
    expect(sendPushNotification).not.toHaveBeenCalled()
  })
})
