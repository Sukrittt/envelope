import { json, getCollection } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { buildCategoryMap, type CategoryMap } from '@/lib/categoryMap'

export const dynamic = 'force-dynamic'

// Per-user, since the map is derived from that user's own expense vocabulary.
// ponytail: unbounded Map on a personal app with a handful of users; swap for
// an LRU if the user count ever makes that a memory concern.
const cache = new Map<string, CategoryMap>()

export async function GET(req: Request) {
  const auth = await getAuth(req)

  let map = cache.get(auth.userId)
  if (!map) {
    const coll = await getCollection('expenses', auth)
    const overridesColl = await getCollection('category_map_overrides', auth)
    map = await buildCategoryMap(coll, overridesColl)
    cache.set(auth.userId, map)
  }
  return json(map)
}
