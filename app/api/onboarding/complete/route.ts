import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { completeOnboarding, getAccess } from '@/lib/billing/service'

export const dynamic = 'force-dynamic'

/**
 * Finish onboarding and start the 45-day trial.
 *
 * Takes no body. The completion instant and the trial dates are the
 * server's, and the action refuses unless the initial budget setup is
 * actually persisted — otherwise a bare POST would mint a trial for an
 * account that never set anything up, and a fresh account could farm a new
 * clock on demand.
 *
 * Idempotent: calling it again returns the same dates.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const db = await getDb()
  const result = await completeOnboarding(db, auth.userId)
  if (!result.ok) return error('initial budget setup not found', 409)

  return json({ onboardedAt: result.onboardedAt, access: await getAccess(auth.userId) })
}
