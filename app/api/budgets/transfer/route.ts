import type { ClientSession } from 'mongodb'
import { json, error, readBody, getCollection } from '@/lib/http'
import type { ScopedCollection } from '@/lib/scoped'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { invalidate } from '@/lib/cache'
import { withTx } from '@/lib/mongodb'
import { casRetry } from '@/lib/cas'

export const dynamic = 'force-dynamic'

/** Matches the client-side sentinel in MoveMoneyModal.tsx / move-money.tsx. */
const RTA_SENTINEL = '__ready_to_assign__'
/** Never carries a balance forward — see carriedAssigned() below. */
const CC_CATEGORY = '__credit_card__'

interface Source {
  category: string
  amount: number
}

/**
 * Moves money between envelopes (or from Ready to Assign into one) in a
 * single transaction. Replaces the old client-side pattern of two
 * independent `PUT /api/budgets` calls — a debit that succeeded followed by
 * a credit that failed used to make money disappear with no error shown.
 *
 * body: { month, to, sources: [{ category, amount }] } — or the single-source
 * shorthand { month, to, from, amount }. `sources[].category` may be the RTA
 * sentinel (debits nothing, RTA is derived, not a stored row).
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const month = typeof body.month === 'string' ? body.month : ''
  const to = typeof body.to === 'string' ? body.to : ''
  const rawSources = Array.isArray(body.sources)
    ? body.sources
    : typeof body.from === 'string' && typeof body.amount === 'number'
      ? [{ category: body.from, amount: body.amount }]
      : null

  if (!month || !to || !rawSources || rawSources.length === 0) {
    return error('month, to, and sources (or from/amount) required')
  }
  if (to === RTA_SENTINEL) return error('cannot transfer to Ready to Assign')

  const sources: Source[] = []
  for (const raw of rawSources as unknown[]) {
    const category = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).category : undefined
    const amount = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).amount : undefined
    if (typeof category !== 'string' || typeof amount !== 'number' || !(amount > 0)) {
      return error('each source needs a category and a positive amount')
    }
    if (category === to) return error('cannot transfer an envelope to itself')
    sources.push({ category, amount })
  }

  const totalAmount = sources.reduce((sum, s) => sum + s.amount, 0)

  const budgetColl = await getCollection('budgets', auth)

  // Fail fast on a source category that has never had a budget row at all —
  // that's a genuinely nonexistent envelope, not just one untouched this
  // month (see carriedAssigned() below for that case).
  for (const source of sources) {
    if (source.category === RTA_SENTINEL) continue
    const existing = await budgetColl.findOne({ category: source.category })
    if (!existing) return error(`no budget row for "${source.category}" in ${month}`, 404)
  }

  await withTx(async (session) => {
    // Debit every non-RTA source. A concurrent insert for the same
    // month+category (the no-row-yet branch below) is caught via the unique
    // partial index and retried as an update — same pattern as the target
    // credit below. Otherwise `assigned` is field-level encrypted so it can't
    // be a filter field; concurrent writes to an *existing* document within a
    // transaction abort with a retryable conflict that `withTransaction`
    // already retries.
    for (const source of sources) {
      if (source.category === RTA_SENTINEL) continue
      await casRetry<'done'>(async () => {
        const existing = await budgetColl.findOne({ month, category: source.category }, { session })
        if (existing) {
          const current = Number(existing.assigned) || 0
          await budgetColl.updateOne(
            { _id: existing._id },
            { $set: { assigned: String(current - source.amount) } },
            { session },
          )
          return 'done'
        }
        // No row yet for this month — the client still shows this envelope
        // as available, carrying forward the most recent prior month's
        // assigned amount until it's explicitly touched (see Mobile's
        // src/lib/envelope.ts::carriedAssigned). Materialize that row now so
        // debiting it here matches what was on screen instead of 404ing.
        const carried = await carriedAssigned(budgetColl, source.category, month, session)
        try {
          await budgetColl.insertOne(
            { month, category: source.category, assigned: String(carried - source.amount), rolled_over: '0' },
            { session },
          )
          return 'done'
        } catch (err) {
          if (isDuplicateKeyError(err)) return 'retry'
          throw err
        }
      })
    }

    // Credit the target, upserting a row if this is its first assignment. A
    // concurrent insert for the same category is caught via the unique
    // partial index and retried as an update.
    await casRetry<'done'>(async () => {
      const existing = await budgetColl.findOne({ month, category: to }, { session })
      if (existing) {
        const current = Number(existing.assigned) || 0
        await budgetColl.updateOne(
          { _id: existing._id },
          { $set: { assigned: String(current + totalAmount) } },
          { session },
        )
        return 'done'
      }
      try {
        await budgetColl.insertOne({ month, category: to, assigned: String(totalAmount), rolled_over: '0' }, { session })
        return 'done'
      } catch (err) {
        if (isDuplicateKeyError(err)) return 'retry'
        throw err
      }
    })
  })

  invalidate('budgets', auth.userId)
  return json({ ok: true })
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000
}

/** The most recent prior month's assigned amount for a category, or 0 if
 * there isn't one — mirrors the client's carry-forward convention (Mobile's
 * src/lib/envelope.ts::carriedAssigned / Web's src/services/budgetLoader.ts).
 * The credit-card envelope never carries: it's money set aside for *last*
 * month's card spending, not a recurring target. */
async function carriedAssigned(
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
