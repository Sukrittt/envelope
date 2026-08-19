import type { ScopedCollection } from './scoped'

export interface CategoryMap {
  words: Record<string, string>
  updatedAt: string
}

/**
 * One `category_map_overrides` doc: word → LLM-picked category.
 *
 * The word lives in a `word` field rather than being the `_id`. It used to be
 * the `_id`, which made it a globally unique key — two users could not both
 * teach the app what "swiggy" means. Uniqueness is now the compound index
 * `{user_id, word}`.
 */
export interface CategoryMapOverride {
  word: string
  category: string
  source: string
  createdAt: string
}

/**
 * Build the word → category autosuggest map from the expenses collection.
 * Port of the legacy buildCategoryMap (vite.config.ts), reading Mongo docs
 * instead of a CSV file.
 *
 * `overridesCollection`, when passed, is merged on top of the frequency-derived
 * words — overrides are deliberate LLM picks (from `/api/category-map/suggest`),
 * not majority-vote noise, so they win on conflicts.
 */
export async function buildCategoryMap(
  collection: ScopedCollection,
  overridesCollection?: ScopedCollection,
): Promise<CategoryMap> {
  const rows = await collection
    .find({}, { projection: { item: 1, category: 1, _id: 0 } })
    .toArray()

  const wordCategories = new Map<string, Map<string, number>>()

  for (const row of rows) {
    const item = String(row.item ?? '')
    const category = String(row.category ?? '')
    if (!item || !category) continue
    const words = item.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length < 2) continue
      let catCount = wordCategories.get(word)
      if (!catCount) {
        catCount = new Map()
        wordCategories.set(word, catCount)
      }
      catCount.set(category, (catCount.get(category) ?? 0) + 1)
    }
  }

  const words: Record<string, string> = {}
  for (const [word, cats] of wordCategories) {
    let bestCat = ''
    let bestCount = 0
    for (const [cat, count] of cats) {
      if (count > bestCount) {
        bestCat = cat
        bestCount = count
      }
    }
    if (bestCat) words[word] = bestCat
  }

  if (overridesCollection) {
    const overrides = await overridesCollection.find({}).toArray()
    for (const doc of overrides) {
      const word = String(doc.word ?? '')
      const category = String(doc.category ?? '')
      if (word && category) words[word] = category
    }
  }

  return { words, updatedAt: new Date().toISOString() }
}
