import { after } from 'next/server'
import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { requireAccess } from '@/lib/billing/guard'
import { pickCategory } from '@/lib/ai/jev'
import { isRateLimited } from '@/lib/rateLimit'
import { invalidateCategoryMap } from '@/lib/categoryMap'
import { aiDisabledResponse } from '@/lib/systemSettings'
import { aiAllowanceResponse } from '@/lib/ai/allowance'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RATE_WINDOW_MS = 60 * 60 * 1000
const SIGNED_IN_LIMIT = 60
const BURST_WINDOW_MS = 60 * 1000
const BURST_LIMIT = 10
const MAX_ITEM_LEN = 200
const MAX_CATEGORIES = 100
const MAX_CATEGORY_LEN = 60

export async function POST(req: Request) {
  // Temporary: per-step latency for the "suggestions feel slow" investigation (read via `vercel logs`).
  let mark = Date.now()
  const timings: Record<string, number> = {}
  const lap = (step: string) => {
    const now = Date.now()
    timings[step] = now - mark
    mark = now
  }
  const auth = await getAuth(req)
  lap('auth')
  const gate = await requireAccess(auth)
  lap('access')
  if (gate) return gate
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const aiOff = await aiDisabledResponse()
  if (aiOff) return aiOff

  const overAllowance = await aiAllowanceResponse(auth)
  if (overAllowance) return overAllowance
  lap('aiGates')

  if (
    await isRateLimited(`category-suggest:${auth.userId}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_LIMIT },
      { windowMs: RATE_WINDOW_MS, limit: SIGNED_IN_LIMIT },
    ])
  ) {
    return error('rate limited', 429)
  }
  lap('rateLimit')

  const body = await readBody(req)
  const item = typeof body.item === 'string' ? body.item.trim().slice(0, MAX_ITEM_LEN) : ''
  const rawCategories = Array.isArray(body.categories) ? body.categories : null

  if (!item) return error('item required')
  if (
    !rawCategories ||
    rawCategories.length === 0 ||
    rawCategories.length > MAX_CATEGORIES ||
    !rawCategories.every((c) => typeof c === 'string' && c && c.length <= MAX_CATEGORY_LEN)
  )
    return error('categories must be a non-empty string array')

  const categoryList = rawCategories as string[]

  let category: string
  try {
    category = await pickCategory(item, categoryList, { userId: auth.userId, feature: 'suggest' })
    lap('model')
    console.info('suggest timing', JSON.stringify(timings))
  } catch {
    return error('category suggestion failed', 502)
  }

  // The category map writes don't change this reply, so they run after it's sent.
  if (category) {
    after(async () => {
      const overridesColl = await getCollection('category_map_overrides', auth)
      const words = item.toLowerCase().split(/\s+/)
      const now = new Date().toISOString()
      await Promise.all(
        words
          .filter((word) => word.length >= 2)
          .map((word) =>
            overridesColl.updateOne(
              { word },
              { $set: { word, category, source: 'llm', createdAt: now } },
              { upsert: true },
            ),
          ),
      )
      invalidateCategoryMap(auth.userId)
    })
  }

  return json({ category })
}
