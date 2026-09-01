import { json, error, getCollection } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { EXPORT_LIMIT, countReadyExportsThisMonth } from '@/lib/exports'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const exports = await getCollection('exports', auth)
  const docs = await exports.find({}).sort({ created_at: -1 }).limit(20).toArray()
  const usedThisMonth = await countReadyExportsThisMonth(auth)

  return json({
    exports: docs.map((d) => ({
      id: d._id.toString(),
      status: d.status,
      created_at: d.created_at,
      error: d.error ?? null,
    })),
    usedThisMonth,
    limit: EXPORT_LIMIT,
  })
}
