import { Type } from '@google/genai'
import { json, error, readBody, getCollection } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { generateJSON } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

interface SuggestResult {
  category: string
}

export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = (await readBody(req)) as Record<string, unknown>
  const item = typeof body.item === 'string' ? body.item.trim() : ''
  const rawCategories = Array.isArray(body.categories) ? body.categories : null

  if (!item) return error('item required')
  if (!rawCategories || rawCategories.length === 0 || !rawCategories.every((c) => typeof c === 'string' && c))
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
  }

  return json({ category })
}
