import type { ObjectId } from 'mongodb'

export interface StoredChatMessage {
  role: 'user' | 'model'
  text: string
  createdAt: Date
}

export interface ChatSessionDoc {
  _id: ObjectId
  user_id: string
  title: string
  messages: StoredChatMessage[]
  createdAt: Date
  updatedAt: Date
}

const TITLE_MAX_LEN = 40

/** Truncate to `maxLen` chars with an ellipsis. Used for both session titles and list previews. */
export function makeTitle(text: string, maxLen = TITLE_MAX_LEN): string {
  const trimmed = text.trim()
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen).trimEnd()}…` : trimmed
}
