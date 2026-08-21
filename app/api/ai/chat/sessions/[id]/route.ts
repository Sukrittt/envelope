import { ObjectId } from 'mongodb'
import { getCollection, json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { COLLECTIONS } from '@/lib/models'

export const dynamic = 'force-dynamic'

/** One session's full transcript. Scoped lookup — an id owned by another user 404s, not 403s. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return error('invalid id', 400)

  const auth = await getAuth(req)
  const sessions = await getCollection(COLLECTIONS.chatSessions, auth)

  const doc = await sessions.findOne({ _id: new ObjectId(id) })
  if (!doc) return error('session not found', 404)

  return json({
    id: String(doc._id),
    title: doc.title,
    messages: doc.messages,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
}
