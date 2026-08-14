import { json, getCollection } from '@/lib/http'
import { getScope } from '@/lib/access'
import { buildCategoryMap, type CategoryMap } from '@/lib/categoryMap'

export const dynamic = 'force-dynamic'

let cache: CategoryMap | null = null
let cacheGuest: boolean | null = null

export async function GET(req: Request) {
  const scope = getScope(req)
  const guest = scope === 'guest'

  if (!cache || cacheGuest !== guest) {
    const coll = await getCollection('expenses', scope)
    const overridesColl = await getCollection('category_map_overrides', scope)
    cache = await buildCategoryMap(coll, overridesColl)
    cacheGuest = guest
  }
  return json(cache)
}
