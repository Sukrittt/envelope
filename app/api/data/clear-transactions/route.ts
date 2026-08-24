import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { invalidate } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  if (body.confirm !== true) return error('confirm required', 400)

  const expenses = await getCollection('expenses', auth)
  const result = await expenses.deleteMany({})
  invalidate('expenses', auth.userId)
  invalidate('wrapped', auth.userId)
  return json({ ok: true, deleted: result.deletedCount })
}
