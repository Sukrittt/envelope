import { getDb } from '@/lib/mongodb'
import { nowIST } from '@/lib/http'
import type { Auth } from '@/lib/access'
import type { UserDoc } from '@/lib/users'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildNotifications, prefsFor } from './rules'
import { claimAndSend } from './deliver'

/**
 * Fires threshold/overspend notifications for one category the instant it
 * changes, right after an expense is logged or edited — the daily cron
 * (`app/api/notifications/run`) still exists for bills/digest/coach, but a
 * "you just crossed 80%" alert is only useful on the spot. Shares the same
 * `buildNotifications` rules and `notification_log` dedupe key as the cron,
 * so whichever fires first wins and the other is a no-op.
 *
 * Never throws — a notification failure must not fail the expense write
 * that triggered it. Callers still don't need to await this if they'd
 * rather not add the latency, but awaiting is what makes "instant" true on
 * a serverless function that suspends once the response is sent.
 */
export async function notifyThresholdCrossed(auth: Auth, category: string): Promise<void> {
  try {
    const db = await getDb()
    const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
    if (!user) return

    const prefs = prefsFor(user)
    if (!prefs.thresholds) return

    const { facts, meta, envelopes, subscriptions, categories } = await buildExpenseContext(auth)
    const { date: today } = nowIST()

    const notifications = buildNotifications({
      envelopes,
      subscriptions,
      categories,
      meta,
      prefs,
      today,
      month: today.slice(0, 7),
    }).filter((n) => (n.kind === 'threshold' || n.kind === 'overspent') && n.data?.category === category)

    for (const notification of notifications) {
      await claimAndSend(db, user._id, notification, facts)
    }
  } catch (err) {
    console.error('notifications: instant threshold check failed for', auth.userId, category, err)
  }
}
