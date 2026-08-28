import { unstable_cache, revalidateTag } from 'next/cache'

/**
 * In-process cache for a collection read, keyed by `<base>:<userId>[:<keySuffix>]`
 * but always tagged by just `<base>:<userId>`. The user id is part of the key on
 * purpose: without it one user's cached rows would be served to the next user who
 * asks for the same collection. `keySuffix` lets one base (e.g. `wrapped`) cache
 * multiple entries per user (one per month) while `invalidate` still busts all of
 * them in one call — a write can't know which month's cache it needs to bust.
 *
 * ponytail: reserve this for reads that do real aggregation (currently only
 * `wrapped`). A plain `coll.find({}).toArray()` gains almost nothing from an
 * extra cache layer — both clients already cache the response themselves —
 * and `revalidateTag` below is fire-and-forget, so a write can respond before
 * the tag is actually busted and a fast client refetch lands on stale data.
 */
export function cachedRead<T>(base: string, userId: string, fn: () => Promise<T>, keySuffix?: string): Promise<T> {
  const tag = `${base}:${userId}`
  const key = keySuffix ? `${tag}:${keySuffix}` : tag
  return unstable_cache(fn, [key], { tags: [tag] })()
}

/** Bust the cache for a collection after a write. */
export function invalidate(base: string, userId: string): void {
  revalidateTag(`${base}:${userId}`)
}
