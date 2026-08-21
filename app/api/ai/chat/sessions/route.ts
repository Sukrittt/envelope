import { getCollection, json } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { COLLECTIONS } from '@/lib/models'

export const dynamic = 'force-dynamic'

/** List the current user's chat sessions, newest first. No transcripts — just enough for a history list. */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const sessions = await getCollection(COLLECTIONS.chatSessions, auth)

  const rows = await sessions
    .find({}, { projection: { title: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 })
    .toArray()

  return json(
    rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      updatedAt: r.updatedAt,
    })),
  )
}
