import { escapeRegExp, getCollection, json } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { COLLECTIONS } from '@/lib/models'
import { makeTitle } from '@/lib/ai/chatSessions'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

interface FacetResult {
  [key: string]: unknown
  data: Array<{ _id: unknown; title: string; updatedAt: Date; messageCount: number; preview?: string }>
  totalCount: Array<{ count: number }>
}

/**
 * List the current user's chat sessions, newest first, paginated and optionally
 * filtered by title. No full transcripts — just enough for a history list.
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const sessions = await getCollection(COLLECTIONS.chatSessions, auth)

  const url = new URL(req.url)
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(url.searchParams.get('limit'))) || DEFAULT_LIMIT))
  const q = url.searchParams.get('q')?.trim()

  const [result] = await sessions
    .aggregate<FacetResult>([
      ...(q ? [{ $match: { title: { $regex: escapeRegExp(q), $options: 'i' } } }] : []),
      { $sort: { updatedAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                title: 1,
                updatedAt: 1,
                messageCount: { $size: '$messages' },
                preview: { $arrayElemAt: ['$messages.text', -1] },
              },
            },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ])
    .toArray()

  const total = result?.totalCount[0]?.count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / limit))

  return json({
    sessions: (result?.data ?? []).map((r) => ({
      id: String(r._id),
      title: r.title,
      updatedAt: r.updatedAt,
      preview: makeTitle(r.preview ?? ''),
      messageCount: r.messageCount,
    })),
    total,
    page,
    pageCount,
  })
}
