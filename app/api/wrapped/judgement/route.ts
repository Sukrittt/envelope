import { json } from '@/lib/http'
import { nowForUser } from '@/lib/userCurrency'
import { getAuth } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { cachedRead } from '@/lib/cache'
import { currentEdition, readRecap } from '@/lib/wrapped'
import { judgeWrapped, type WrappedJudgement } from '@/lib/ai/wrappedPersona'

export const dynamic = 'force-dynamic'

const NO_JUDGEMENT: WrappedJudgement = { persona: null, treatCategory: null }

/**
 * Jev's read of a month, served apart from the recap so Wrapped renders
 * without waiting on it.
 *
 * Cached under its own base on purpose: an expense write calls
 * `invalidate('wrapped', ...)`, and busting a *closed* month's persona because
 * the user logged today's lunch would re-pay the Jev call on every visit. The
 * trade is that editing an old expense leaves that month's persona stale —
 * fine for a vibe, and the recap numbers beside it still update.
 *
 * A judgement with nothing in it throws rather than returning, so a gateway
 * outage isn't cached as "no persona" for the rest of the month.
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const gate = await requireAccess(auth)
  if (gate) return gate
  const month = new URL(req.url).searchParams.get('month') ?? currentEdition((await nowForUser(auth.userId)).date)

  const judgement = await cachedRead(
    'wrapped-judgement',
    auth.userId,
    async () => {
      const result = await judgeWrapped(await readRecap(auth, month), { userId: auth.userId, feature: 'wrapped' })
      if (!result.persona && !result.treatCategory) throw new Error('no judgement to cache')
      return result
    },
    month,
  ).catch(() => NO_JUDGEMENT)

  return json(judgement)
}
