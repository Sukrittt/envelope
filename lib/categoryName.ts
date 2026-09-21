import type { ClientSession } from 'mongodb'
import { getCollection } from '@/lib/http'
import type { Auth } from '@/lib/access'

/**
 * Map a category name a client may have loaded *before* a rename onto the name
 * that category has now.
 *
 * Categories are keyed by their own mutable `name`, so any cached list — a
 * mobile screen opened five minutes ago, an expense queued offline and flushed
 * after the rename, the nightly recurring cron — can reference a name that no
 * longer exists. Writing that name through unchecked orphans the row: it shows
 * under a category that is in no group and counts against no envelope.
 *
 * `app/api/categories/route.ts` records the old name in `previousNames` when it
 * renames, so those late writes land where the user expects instead.
 *
 * A live category always wins over an alias: recreating a freed-up name must
 * not redirect new writes to whatever renamed away from it.
 */
export async function resolveCategoryName(auth: Auth, name: string, session?: ClientSession): Promise<string> {
  const coll = await getCollection('categories', auth)
  const options = session ? { session } : undefined
  if (await coll.findOne({ name }, options)) return name
  // ponytail: first alias match wins. Two categories can only share one if a
  // freed name was recreated and then renamed away again; re-key categories to
  // `_id` if that stops being hypothetical.
  const aliased = await coll.findOne({ previousNames: name }, options)
  return aliased ? String(aliased.name) : name
}
