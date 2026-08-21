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

/** Derive a session's list title from its first user message. */
export function makeTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim()
  return trimmed.length > TITLE_MAX_LEN ? `${trimmed.slice(0, TITLE_MAX_LEN).trimEnd()}…` : trimmed
}
