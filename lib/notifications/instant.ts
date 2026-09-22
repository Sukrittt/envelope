import { getDb } from '@/lib/mongodb'
import { nowIn } from '@/lib/http'
import type { Auth } from '@/lib/access'
import type { UserDoc } from '@/lib/users'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildNotifications, categoryLevel, prefsFor } from './rules'
import { claimAndSend } from './deliver'
import { syncLevel } from './thresholdState'

/**
 * Reconciles the recorded threshold level for every category changed by one
 * write. A budget transfer can affect several envelopes at once, so this
 * batches the expensive context build while still applying each category's
 * level independently.
 *
 * Rising levels send the highest currently crossed threshold. Falling levels
 * only update state, re-arming every threshold above the new level. When a
 * budget mutation supplies `changedMonth`, historical edits are ignored so
 * they cannot alter the current month's notification state.
 *
 * Never throws — notification work must not fail the money write that caused
 * it. Awaiting is still important because a serverless function may suspend as
 * soon as its response is sent.
 */
export async function reconcileThresholdLevels(
  auth: Auth,
  changedCategories: string[],
  changedMonth?: string,
): Promise<void> {
  try {
    const affected = [...new Set(changedCategories.filter(Boolean))]
    if (affected.length === 0) return

    const db = await getDb()
    const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
    if (!user) return

    const prefs = prefsFor(user)
    if (!prefs.thresholds) return

    const { date: today } = nowIn(user.timezone)
    const month = today.slice(0, 7)
    if (changedMonth && changedMonth !== month) return

    const { facts, meta, envelopes, subscriptions, categories } = await buildExpenseContext(auth)

    const notifications = buildNotifications({
      envelopes,
      subscriptions,
      categories,
      meta,
      prefs,
      today,
      month,
    }).filter((n) => n.kind === 'threshold' || n.kind === 'overspent')

    for (const category of affected) {
      const notification = notifications.find((n) => n.data?.category === category)
      if (notification) {
        // claimAndSend always syncs the level first. A downward move therefore
        // records the lower level but returns false and sends nothing.
        await claimAndSend(db, user._id, notification, facts)
      } else {
        // Below every configured threshold (or no longer an envelope): sync to
        // zero so the first threshold can fire again later.
        await syncLevel(db, user._id, month, category, categoryLevel(envelopes, categories, category))
      }
    }
  } catch (err) {
    console.error('notifications: instant threshold reconciliation failed for', auth.userId, changedCategories, err)
  }
}

/** Reconciles one category after an expense is logged, edited, or deleted. */
export async function notifyThresholdCrossed(auth: Auth, category: string): Promise<void> {
  await reconcileThresholdLevels(auth, [category])
}
