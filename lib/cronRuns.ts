import { getDb } from './mongodb'

export const CRON_RUNS = 'cron_runs'
export const CRON_JOBS = { notifications: '/api/notifications/run', gc: '/api/cron/gc', billing: '/api/cron/billing' } as const
export type CronJob = keyof typeof CRON_JOBS

/** Header the admin "Run now" action sends alongside CRON_SECRET, so the run is recorded as manual. */
export const TRIGGER_HEADER = 'x-aviary-trigger'

export interface CronRunDoc {
  job: CronJob
  trigger: 'cron' | 'admin'
  startedAt: Date
  finishedAt: Date
  durationMs: number
  ok: boolean
  result: Record<string, unknown> | null
  error: string | null
}

/** Only call after the CRON_SECRET check passed — the header is trusted from there on. */
export function triggerOf(req: Request): CronRunDoc['trigger'] {
  return req.headers.get(TRIGGER_HEADER) === 'admin' ? 'admin' : 'cron'
}

/**
 * Runs a cron job body and records the outcome in `cron_runs` for /admin/jobs.
 * Recording never fails the job; the job's own error is rethrown after it's recorded.
 */
export async function recordCronRun<T extends Record<string, unknown>>(job: CronJob, trigger: CronRunDoc['trigger'], fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date()
  const save = async (ok: boolean, result: T | null, error: string | null) => {
    const finishedAt = new Date()
    try {
      const db = await getDb()
      await db.collection<CronRunDoc>(CRON_RUNS).insertOne({ job, trigger, startedAt, finishedAt, durationMs: finishedAt.getTime() - startedAt.getTime(), ok, result, error })
    } catch (err) {
      console.warn('[cronRuns] could not record run:', (err as Error).message)
    }
  }

  try {
    const result = await fn()
    await save(true, result, null)
    return result
  } catch (err) {
    await save(false, null, (err as Error).message)
    throw err
  }
}
