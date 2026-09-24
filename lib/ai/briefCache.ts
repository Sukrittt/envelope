import { ObjectId } from 'mongodb'
import { getDb } from '../mongodb'
import { fingerprint } from '../recurringDetection'

/**
 * The money brief is expensive to build (six collection reads plus two model
 * calls), so the finished payload is cached per user. Any write to a
 * collection the brief reports on drops that user's cached copy, so the next
 * open rebuilds instead of showing a figure the user just changed.
 */
export const BRIEF_CACHE_COLLECTION = 'ai_brief'

/** Collections whose contents appear in the brief's numbers. */
export const BRIEF_SOURCES = new Set(['expenses', 'budgets', 'categories', 'groups', 'subscriptions', 'holdings'])

/** Deterministic id so a user's brief occupies exactly one document per key. */
export function briefCacheId(userId: string, key: string): ObjectId {
  return new ObjectId(fingerprint([userId, key]).slice(0, 24))
}

/**
 * Drops a user's cached brief. Deliberately not awaited by its callers: a
 * cache that fails to clear must never fail the write that triggered it, and
 * the brief rebuilds on the next request either way.
 */
export async function invalidateBrief(userId: string): Promise<void> {
  try {
    const db = await getDb()
    await db.collection(BRIEF_CACHE_COLLECTION).deleteMany({ user_id: userId })
  } catch (err) {
    console.warn('[brief] could not clear cache:', (err as Error).message)
  }
}
