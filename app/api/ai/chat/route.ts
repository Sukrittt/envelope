import { ObjectId } from 'mongodb'
import { readBody, error, getCollection } from '@/lib/http'
import { getAuth, type Auth } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildSystemPrompt } from '@/lib/ai/moneyBrainPrompt'
import { streamText } from '@/lib/ai/gemini'
import { makeTitle, type StoredChatMessage } from '@/lib/ai/chatSessions'
import { COLLECTIONS } from '@/lib/models'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LEN = 500
const HISTORY_LIMIT = 8
const RATE_WINDOW_MS = 60 * 60 * 1000
const SIGNED_IN_LIMIT = 60
const DEMO_LIMIT = 20

// ponytail: in-memory buckets per user id. Resets on redeploy/cold start and
// isn't shared across instances — not durable, but an accepted tradeoff for a
// personal-use app. Note the demo user is a single shared bucket, so its limit
// covers all signed-out traffic at once. Swap for a real store (Mongo/Upstash)
// if traffic/abuse ever becomes a problem.
const requestTimestamps = new Map<string, number[]>()

function rateLimited(auth: Auth): boolean {
  let bucket = requestTimestamps.get(auth.userId)
  if (!bucket) {
    bucket = []
    requestTimestamps.set(auth.userId, bucket)
  }
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS
  while (bucket.length && bucket[0] < cutoff) bucket.shift()
  if (bucket.length >= (auth.readOnly ? DEMO_LIMIT : SIGNED_IN_LIMIT)) return true
  bucket.push(now)
  return false
}

type ModelContents = Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>

/**
 * Runs the Gemini stream and forwards SSE frames to the client. `onSettle`
 * fires exactly once with whatever assistant text accumulated, either after
 * a normal finish/error or on `cancel()` (the client aborting/disconnecting
 * mid-stream) — so a persisted session never silently loses the reply's tail.
 */
function streamReply(
  auth: Auth,
  contents: ModelContents,
  leadingEvent: Record<string, unknown> | null,
  onSettle: (fullText: string) => Promise<void> | void,
): Response {
  const encoder = new TextEncoder()
  let full = ''
  let settled = false
  const settle = async () => {
    if (settled) return
    settled = true
    try {
      await onSettle(full)
    } catch (err) {
      console.error('[ai/chat] failed to persist reply:', err)
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (leadingEvent) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(leadingEvent)}\n\n`))
        }
        const { facts } = await buildExpenseContext(auth)
        const systemPrompt = buildSystemPrompt(facts)
        const geminiStream = await streamText(systemPrompt, contents)

        for await (const chunk of geminiStream) {
          const text = chunk.text
          if (text) {
            full += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        await settle()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
        await settle()
      } finally {
        controller.close()
      }
    },
    async cancel() {
      await settle()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

interface ClientMessage {
  role: 'user' | 'model'
  text: string
}

function isValidMessages(value: unknown): value is ClientMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string',
    )
  )
}

/** Demo/read-only user: today's exact stateless behaviour, nothing touches the DB. */
function handleDemo(auth: Auth, body: Record<string, unknown>): Response {
  const messages = body.messages

  if (!isValidMessages(messages)) return error('invalid body', 400)

  const last = messages[messages.length - 1]
  if (last.role !== 'user' || !last.text.trim() || last.text.length > MAX_MESSAGE_LEN) {
    return error('invalid body', 400)
  }

  const trimmed = messages.slice(-HISTORY_LIMIT)
  const contents: ModelContents = trimmed.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
  return streamReply(auth, contents, null, () => {})
}

/** Real user: sessions persisted to `chat_sessions`, keyed by an id the client threads through. */
async function handlePersisted(auth: Auth, body: Record<string, unknown>): Promise<Response> {
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message.length > MAX_MESSAGE_LEN) return error('invalid body', 400)

  const rawSessionId = body.sessionId
  const sessionId = typeof rawSessionId === 'string' && rawSessionId ? rawSessionId : null
  if (sessionId && !ObjectId.isValid(sessionId)) return error('invalid body', 400)

  const sessions = await getCollection(COLLECTIONS.chatSessions, auth)

  let objectId: ObjectId
  let history: StoredChatMessage[] = []

  if (sessionId) {
    const existing = await sessions.findOne({ _id: new ObjectId(sessionId) })
    if (!existing) return error('session not found', 404)
    objectId = existing._id as ObjectId
    history = (existing.messages as StoredChatMessage[] | undefined) ?? []
  } else {
    const now = new Date()
    const inserted = await sessions.insertOne({
      title: makeTitle(message),
      messages: [],
      createdAt: now,
      updatedAt: now,
    })
    objectId = inserted.insertedId as ObjectId
  }

  const now = new Date()
  const userMsg: StoredChatMessage = { role: 'user', text: message, createdAt: now }
  await sessions.updateOne({ _id: objectId }, { $push: { messages: userMsg }, $set: { updatedAt: now } } as never)

  const trimmed = [...history, userMsg].slice(-HISTORY_LIMIT)
  const contents: ModelContents = trimmed.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))

  return streamReply(auth, contents, sessionId ? null : { sessionId: objectId.toString() }, async (fullText) => {
    if (!fullText) return
    const modelMsg: StoredChatMessage = { role: 'model', text: fullText, createdAt: new Date() }
    await sessions.updateOne(
      { _id: objectId },
      { $push: { messages: modelMsg }, $set: { updatedAt: new Date() } } as never,
    )
  })
}

export async function POST(req: Request) {
  const auth = await getAuth(req)

  if (rateLimited(auth)) {
    return error('rate limited', 429)
  }

  const body = (await readBody(req)) as Record<string, unknown>

  return auth.readOnly ? handleDemo(auth, body) : handlePersisted(auth, body)
}
