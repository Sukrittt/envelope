import { unstable_cache, revalidateTag } from 'next/cache'
import type { Scope } from './access'

/** In-process cache for a collection read, keyed + tagged by `<base>:<scope>`. */
export function cachedRead<T>(base: string, scope: Scope, fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, [`${base}:${scope}`], { tags: [`${base}:${scope}`] })()
}

/** Bust the cache for a collection after a write. */
export function invalidate(base: string, scope: Scope): void {
  revalidateTag(`${base}:${scope}`)
}
