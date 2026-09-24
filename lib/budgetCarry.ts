import type { ClientSession } from 'mongodb'
import type { ScopedCollection } from '@/lib/scoped'

/** Never carries a balance forward — see carriedAssigned() below. */
const CC_CATEGORY = '__credit_card__'

/** The most recent prior month's assigned amount for a category, or 0 if
 * there isn't one — mirrors the client's carry-forward convention (Mobile's
 * src/lib/envelope.ts::carriedAssigned / Web's src/services/budgetLoader.ts).
 * The credit-card envelope never carries: it's money set aside for *last*
 * month's card spending, not a recurring target. */
export async function carriedAssigned(
  budgetColl: ScopedCollection,
  category: string,
  month: string,
  session: ClientSession,
): Promise<number> {
  if (category === CC_CATEGORY) return 0
  const rows = await budgetColl.find({ category }, { session }).toArray()
  const prior = rows
    .filter((r) => typeof r.month === 'string' && r.month < month)
    .sort((a, b) => (b.month as string).localeCompare(a.month as string))[0]
  return prior ? Number(prior.assigned) || 0 : 0
}
