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
  Essentials: '🧺',
  Lifestyle: '🛍️',
  Food: '🍔',
  Travel: '✈️',
  Entertainment: '🎉',
  Savings: '🪙',
  Investments: '💎',
}

const CATEGORY_EMOJI: Record<string, string> = {
  rent: '🏠',
  water: '🚿',
  electricity: '⚡',
  utilities: '🔌',
  cook: '👨‍🍳',
  'bathroom clean': '🚻',
  'furniture rent': '🪑',
  laundry: '🧺',
  bills: '📋',
  groceries: '🛒',
  grocery: '🛒',
  'food order': '🍜',
  'eating out': '🍽️',
  food: '🍔',
  travel: '✈️',
  transport: '🚗',
  fuel: '⛽',
  vacation: '🏖️',
  football: '⚽',
  outings: '🎡',
  entertainment: '🎬',
  software: '💻',
  shopping: '🛍️',
  clothes: '👕',
  haircut: '💇',
  "children's": '🧸',
  miscellaneous: '📁',
  subscriptions: '📱',
  investments: '💎',
  savings: '🪙',
  'emergency fund': '🛟',
  'rainy day': '🌧️',
  gifts: '🎁',
}

export function groupEmoji(name: string): string {
  return splitEmoji(name).icon || GROUP_EMOJI[name] || '📁'
}

export function categoryEmoji(name: string, group?: string): string {
  const { icon } = splitEmoji(name)
  return icon || CATEGORY_EMOJI[name.trim().toLowerCase()] || (group ? GROUP_EMOJI[group] : '') || '💰'
}

// Keep the same stable, soft-hue cycle as Mobile's Activity avatars.
const AVATAR_HUES = [
  'var(--mint-soft)',
  'var(--violet-soft)',
  'var(--blue-soft)',
  'var(--gold-soft)',
  'var(--warn-soft)',
  'var(--coral-soft)',
]

/** Deterministic avatar tint for a category, shared by Activity and Insights
 *  so one category is never two colours in the same session. */
export function avatarColorFor(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length]
}
