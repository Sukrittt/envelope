import { Type } from '@google/genai'
import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { generateJSON } from '@/lib/ai/gemini'
import { isRateLimited } from '@/lib/rateLimit'
import { invalidateCategoryMap } from '@/lib/categoryMap'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RATE_WINDOW_MS = 60 * 60 * 1000
const SIGNED_IN_LIMIT = 60
const BURST_WINDOW_MS = 60 * 1000
const BURST_LIMIT = 10
const MAX_ITEM_LEN = 200
const MAX_CATEGORIES = 100
const MAX_CATEGORY_LEN = 60

interface SuggestResult {
  category: string
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  if (
    await isRateLimited(`category-suggest:${auth.userId}`, [
      { windowMs: BURST_WINDOW_MS, limit: BURST_LIMIT },
      { windowMs: RATE_WINDOW_MS, limit: SIGNED_IN_LIMIT },
    ])
  ) {
    return error('rate limited', 429)
  }

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

  let result: SuggestResult
  try {
    result = await generateJSON<SuggestResult>(
      `Pick the single best-fit budgeting category for this expense item: "${item}".\n` +
        `Choose exactly one value from the allowed category list. If none fit well, omit the category field entirely.`,
      {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            format: 'enum',
            enum: categoryList,
          },
        },
      },
    )
  } catch {
    return error('category suggestion failed', 502)
  }

  const category = result.category ?? ''

  if (category) {
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
  }

  return json({ category })
}
