// Category/group names from the API already embed their emoji as the leading
// character (e.g. "🏠 Rent" — see productivity/categories.csv). splitEmoji()
// pulls that out; the lookup tables below only cover legacy plain names.
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u

export function splitEmoji(raw: string): { icon: string; text: string } {
  const trimmed = raw.trim()
  const match = trimmed.match(LEADING_EMOJI_RE)
  if (match) {
    const text = trimmed.slice(match[0].length).trim()
    if (text) return { icon: match[1], text }
  }
  return { icon: '', text: trimmed }
}

export const GROUP_EMOJI: Record<string, string> = {
  Home: '🏠',
  Food: '🍔',
  Travel: '🛵',
  Entertainment: '🎉',
  Investments: '💎',
}

const CATEGORY_EMOJI: Record<string, string> = {
  rent: '🏠',
  water: '🚿',
  electricity: '⚡',
  cook: '👨‍🍳',
  'bathroom clean': '🚻',
  'furniture rent': '🪑',
  laundry: '🧺',
  bills: '📋',
  groceries: '🍅',
  'food order': '🍜',
  travel: '🛵',
  football: '⚽',
  outings: '🎡',
  shopping: '🎁',
  miscellaneous: '📺',
  subscriptions: '📱',
  investments: '💎',
}

export function groupEmoji(name: string): string {
  return splitEmoji(name).icon || GROUP_EMOJI[name] || '📁'
}

export function categoryEmoji(name: string, group?: string): string {
  const { icon } = splitEmoji(name)
  return icon || CATEGORY_EMOJI[name.trim().toLowerCase()] || (group ? GROUP_EMOJI[group] : '') || '💰'
}
