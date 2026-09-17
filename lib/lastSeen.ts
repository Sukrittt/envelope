import { getDb } from './mongodb'

const TOUCH_INTERVAL_MS = 60 * 60 * 1000

// ponytail: per-instance map, never pruned — one entry per active user, fine at this scale.
const lastTouched = new Map<string, number>()

/**
 * Stamps `users.lastSeenAt` at most once an hour per user (per server
 * instance), feeding the admin page's last-active column and active-user
 * counts. The filter also skips the write when another instance already
 * stamped it within the hour. Never throws — activity tracking must not fail
 * a real request.
 */
export async function touchLastSeen(userId: string): Promise<void> {
  const now = Date.now()
  if (now - (lastTouched.get(userId) ?? 0) < TOUCH_INTERVAL_MS) return
  lastTouched.set(userId, now)

  try {
    const db = await getDb()
    await db.collection<{ _id: string; lastSeenAt?: Date }>('users').updateOne(
      { _id: userId, $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: new Date(now - TOUCH_INTERVAL_MS) } }] },
      { $set: { lastSeenAt: new Date(now) } },
    )
  } catch (err) {
    console.warn('[lastSeen] stamp failed:', (err as Error).message)
  }
}
