import { json, getCollection } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getCachedCategoryMap } from '@/lib/categoryMap'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)

  const coll = await getCollection('expenses', auth)
  const overridesColl = await getCollection('category_map_overrides', auth)
  const map = await getCachedCategoryMap(auth.userId, coll, overridesColl)
  return json(map)
}
