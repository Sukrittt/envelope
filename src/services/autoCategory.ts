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

const EMOJI_RE =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu

function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, '').trim().toLowerCase()
}

function fuzzyMatch(oldCat: string, budgetCats: string[]): string {
  const cleaned = stripEmoji(oldCat)
  if (!cleaned) return ''
  let best = ''
  let bestScore = 0
  for (const bc of budgetCats) {
    const bcCleaned = stripEmoji(bc)
    if (bcCleaned === cleaned) return bc
    const score = scoreSimilarity(cleaned, bcCleaned)
    if (score > bestScore) { best = bc; bestScore = score }
  }
  return bestScore > 0.5 ? best : ''
}

function scoreSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const aWords = a.split(/\s+/)
  const bWords = b.split(/\s+/)
  let shared = 0
  for (const w of aWords) if (bWords.includes(w)) shared++
  const total = Math.max(aWords.length, bWords.length)
  return total > 0 ? shared / total : 0
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

  if (bestCat) {
    const fuzzy = fuzzyMatch(bestCat, categories)
    if (fuzzy) return fuzzy
  }

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
