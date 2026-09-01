import { after } from 'next/server'
import { json, error, getCollection, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { EXPORT_LIMIT, countReadyExportsThisMonth, currentMonthKey, buildAndStoreExport } from '@/lib/exports'

export const dynamic = 'force-dynamic'

/**
 * Kicks off a background export instead of building it inline: workbook
 * generation is a fire-and-forget `after()` call (lib/exports.ts) so this
 * responds immediately, and the user is notified via push when it's ready.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const usedThisMonth = await countReadyExportsThisMonth(auth)
  if (usedThisMonth >= EXPORT_LIMIT) {
    return error('monthly export limit reached', 429)
  }

  const exports = await getCollection('exports', auth)
  const { insertedId } = await exports.insertOne({
    status: 'pending',
    month: currentMonthKey(),
    created_at: nowIST().timestamp,
  })

  after(() => buildAndStoreExport(auth.userId, insertedId.toString()))

  // Not decremented for this pending export: quota only counts `ready` exports
  // (a failed one shouldn't have looked like it used a slot).
  return json(
    { id: insertedId.toString(), status: 'pending', remaining: EXPORT_LIMIT - usedThisMonth },
    { status: 202 },
  )
}
