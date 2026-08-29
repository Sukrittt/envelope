import type { Db } from 'mongodb'

const COLLECTION = 'notification_threshold_state'

/**
 * Atomically records `category`'s current crossed level for `month` and
 * reports whether it just rose above where it was last recorded. A drop
 * (edited/deleted expense) lowers the recorded level, so climbing back past
 * the same threshold later fires again — this replaces the old "claimed
 * forever this month" dedupe for threshold/overspend pushes.
 */
export async function syncLevel(db: Db, userId: string, month: string, category: string, level: number): Promise<boolean> {
  const prev = await db.collection(COLLECTION).findOneAndUpdate(
    { user_id: userId, month, category },
    { $set: { level, updatedAt: new Date() } },
    { upsert: true, returnDocument: 'before' },
  )
  return level > (prev?.level ?? 0)
}
