import { getCategoryMap } from './api'

let cachedMap: Record<string, string> | null = null
let lastFetch = 0
const CACHE_TTL = 60000

async function ensureMap(): Promise<Record<string, string>> {
  const now = Date.now()
  if (cachedMap && now - lastFetch < CACHE_TTL) return cachedMap
  const data = await getCategoryMap()
  cachedMap = data.words
  lastFetch = now
  return cachedMap
}

export function invalidateCategoryCache() {
  cachedMap = null
  lastFetch = 0
}

export async function suggestCategory(item: string, categories: string[]): Promise<string> {
  if (!item.trim()) return ''
  const map = await ensureMap()
  const words = item.toLowerCase().split(/\s+/)

  const matched = new Map<string, number>()
  for (const word of words) {
    if (word.length < 2) continue
    const cat = map[word]
    if (cat) matched.set(cat, (matched.get(cat) ?? 0) + 1)
  }

  let bestCat = ''
  let bestScore = 0
  for (const [cat, score] of matched) {
    if (score > bestScore) { bestCat = cat; bestScore = score }
  }

  if (bestCat && categories.includes(bestCat)) return bestCat
  if (bestCat) return bestCat

  const catLower = categories.map(c => c.toLowerCase())
  for (const word of words) {
    const idx = catLower.indexOf(word)
    if (idx !== -1) return categories[idx]
  }

  return ''
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
