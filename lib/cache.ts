import { unstable_cache, revalidateTag } from 'next/cache'

/**
 * In-process cache for a collection read, keyed + tagged by `<base>:<userId>`.
 * The user id is part of the key on purpose: without it one user's cached rows
 * would be served to the next user who asks for the same collection.
 */
export function cachedRead<T>(base: string, userId: string, fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, [`${base}:${userId}`], { tags: [`${base}:${userId}`] })()
}

/** Bust the cache for a collection after a write. */
export function invalidate(base: string, userId: string): void {
  revalidateTag(`${base}:${userId}`)
}
