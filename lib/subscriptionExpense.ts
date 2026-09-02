import { getCollection, nowIST } from '@/lib/http'
import { invalidate } from '@/lib/cache'
import { invalidateCategoryMap } from '@/lib/categoryMap'
import { notifyThresholdCrossed } from '@/lib/notifications/instant'
import type { Auth } from '@/lib/access'

/**
 * Inserts one auto-generated `expenses` row for a subscription that's due
 * today. Same shape and post-insert bookkeeping as the manual
 * `app/api/expenses` POST route (cache invalidation, threshold check) —
 * shared here so the cron (`app/api/notifications/run`) doesn't call that
 * route over HTTP, same reasoning as `applyHoldingAction`.
 */

export type SubscriptionExpenseResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'no-category' }

export async function applySubscriptionExpense(
  auth: Auth,
  sub: { service: string; amount_inr: string; category: string; notes?: string },
): Promise<SubscriptionExpenseResult> {
  if (!sub.category) return { ok: false, reason: 'no-category' }

  const ist = nowIST()
  const notes = sub.notes ? `Auto-added from subscription · ${sub.notes}` : 'Auto-added from subscription'

  const coll = await getCollection('expenses', auth)
  const inserted = await coll.insertOne({
    timestamp: `${ist.date}T${ist.timestamp.slice(11)}`,
    date: ist.date,
    item: sub.service,
    amount_inr: sub.amount_inr,
    category: sub.category,
    notes,
    source: 'subscription',
    amount: '',
    description: '',
    payment_method: 'bank',
  })

  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  invalidateCategoryMap(auth.userId)
  await notifyThresholdCrossed(auth, sub.category)

  return { ok: true, id: String(inserted.insertedId) }
}
