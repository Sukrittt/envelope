import { timingSafeEqual, createHash } from 'node:crypto'
import { json } from '@/lib/http'
import { getDb } from '@/lib/mongodb'
import { recordCronRun, triggerOf } from '@/lib/cronRuns'
import { BILLING_EVENTS, BILLING_SUBSCRIPTIONS, type BillingEventDoc, type BillingSubscriptionDoc } from '@/lib/billing/records'
import { refreshFromProvider } from '@/lib/billing/service'
import { runRetention, sendTrialReminders, type RetentionResult } from '@/lib/billing/lifecycle'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

/** How far ahead of an entitlement's expiry to start re-checking it. */
const LOOKAHEAD_MS = 36 * 60 * 60 * 1000
/** Cap per run, so one slow provider cannot run the function out of time. */
const MAX_PER_RUN = 200

/**
 * Daily billing reconciliation.
 *
 * Webhooks get lost, arrive out of order, and fail to process. Renewals are a
 * silent, scheduled event that no client is awake for. So the projection is
 * repaired on a schedule rather than being assumed correct: without this, a
 * user whose renewal notification went missing is quietly locked out of an
 * account they are still paying for.
 *
 * Two queues, both re-verified the same way:
 *  - subscriptions whose entitlement has lapsed or lapses within a day and a half
 *  - accounts whose last webhook failed to process
 *
 * Then the lifecycle jobs (lib/billing/lifecycle.ts): trial reminders, and the
 * retention window.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || !header || !safeEqual(header, `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await recordCronRun('billing', triggerOf(req), reconcile)
  return json({ ok: true, ...result })
}

async function reconcile(): Promise<{ checked: number; failed: number; trialReminders: number; retention: RetentionResult }> {
  const db = await getDb()
  const horizon = new Date(Date.now() + LOOKAHEAD_MS)

  const [dueSubs, failedEvents] = await Promise.all([
    db
      .collection<BillingSubscriptionDoc>(BILLING_SUBSCRIPTIONS)
      .find({ expiresAt: { $lte: horizon } }, { projection: { userId: 1 } })
      .limit(MAX_PER_RUN)
      .toArray(),
    db
      .collection<BillingEventDoc>(BILLING_EVENTS)
      .find({ state: 'failed', userId: { $ne: null } }, { projection: { userId: 1 } })
      .limit(MAX_PER_RUN)
      .toArray(),
  ])

  const userIds = [...new Set([...dueSubs.map((s) => s.userId), ...failedEvents.map((e) => e.userId!)])]

  let failed = 0
  for (const userId of userIds) {
    try {
      await refreshFromProvider(userId)
      // Only clear the retry backlog once the account genuinely re-verified.
      await db
        .collection<BillingEventDoc>(BILLING_EVENTS)
        .updateMany({ userId, state: 'failed' }, { $set: { state: 'processed', processedAt: new Date() } })
    } catch (err) {
      // Left alone on purpose — a provider outage must not be written down as
      // a lapsed subscription. The row keeps its last verified state and this
      // account is picked up again tomorrow.
      failed++
      console.error('cron/billing: reconciliation failed for', userId, (err as Error).message)
    }
  }

  // Reminders and retention run *after* reconciliation on purpose: the projection
  // they read has just been repaired, so a renewal whose webhook went missing
  // is not mistaken for a lapse.
  const now = new Date()
  const { sent } = await sendTrialReminders(db, now)
  const retention = await runRetention(db, now)

  return { checked: userIds.length, failed, trialReminders: sent, retention }
}
