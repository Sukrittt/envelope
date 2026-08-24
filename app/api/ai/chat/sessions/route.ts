import { getCollection, json } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { COLLECTIONS } from '@/lib/models'
import { makeTitle, type StoredChatMessage } from '@/lib/ai/chatSessions'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

/**
 * List the current user's chat sessions, newest first, paginated and optionally
 * filtered by title. No full transcripts — just enough for a history list.
 *
 * `title` and `messages[].text` are encrypted (lib/scoped.ts), so a Mongo
 * $regex search and an $arrayElemAt preview can't run server-side against
 * ciphertext — scoped().find() decrypts on the way out, and filtering/
 * pagination/preview happen here in JS instead. A denormalized `last_message`
 * field would avoid loading full transcripts if session counts ever get large
 * enough for that to matter — they don't yet.
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const sessions = await getCollection(COLLECTIONS.chatSessions, auth)

  const url = new URL(req.url)
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(url.searchParams.get('limit'))) || DEFAULT_LIMIT))
  const q = url.searchParams.get('q')?.trim().toLowerCase()

  const all = await sessions
    .find({}, { projection: { title: 1, updatedAt: 1, messages: 1 } })
    .sort({ updatedAt: -1 })
    .toArray()

  const filtered = q ? all.filter((s) => String(s.title ?? '').toLowerCase().includes(q)) : all
  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const pageRows = filtered.slice(start, start + limit)

  return json({
    sessions: pageRows.map((r) => {
      const messages = Array.isArray(r.messages) ? (r.messages as StoredChatMessage[]) : []
      return {
        id: String(r._id),
        title: r.title,
        updatedAt: r.updatedAt,
        preview: makeTitle(messages.at(-1)?.text ?? ''),
        messageCount: messages.length,
      }
    }),
    total,
    page,
    pageCount,
  })
}
