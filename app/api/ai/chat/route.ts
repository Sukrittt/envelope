import { readBody, error } from '@/lib/http'
import { getScope } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildSystemPrompt } from '@/lib/ai/moneyBrainPrompt'
import { streamText } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

const MAX_MESSAGE_LEN = 500
const HISTORY_LIMIT = 8
const GUEST_RATE_LIMIT = 20
const GUEST_RATE_WINDOW_MS = 60 * 60 * 1000

// ponytail: single global in-memory bucket (no per-user id exists in this
// single-user app) guarding guest-scope chat calls. Resets on redeploy/cold
// start and isn't shared across instances — not durable, but an accepted
// tradeoff for a personal-use guest demo. Swap for a real store if guest
// traffic/abuse ever becomes a problem.
const guestRequestTimestamps: number[] = []

function guestRateLimited(): boolean {
  const now = Date.now()
  const cutoff = now - GUEST_RATE_WINDOW_MS
  while (guestRequestTimestamps.length && guestRequestTimestamps[0] < cutoff) {
    guestRequestTimestamps.shift()
  }
  if (guestRequestTimestamps.length >= GUEST_RATE_LIMIT) return true
  guestRequestTimestamps.push(now)
  return false
}

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

function isValidMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) => m && typeof m === 'object' && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string',
    )
  )
}

export async function POST(req: Request) {
  const scope = getScope(req)

  if (scope === 'guest' && guestRateLimited()) {
    return error('rate limited', 429)
  }

  const body = await readBody(req)
  const messages = (body as Record<string, unknown>).messages

  if (!isValidMessages(messages)) {
    return error('invalid body', 400)
  }

  const last = messages[messages.length - 1]
  if (last.role !== 'user' || !last.text.trim() || last.text.length > MAX_MESSAGE_LEN) {
    return error('invalid body', 400)
  }

  const trimmed = messages.slice(-HISTORY_LIMIT)
  const contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = trimmed.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { facts } = await buildExpenseContext(scope)
        const systemPrompt = buildSystemPrompt(facts)
        const geminiStream = await streamText(systemPrompt, contents)

        for await (const chunk of geminiStream) {
          const text = chunk.text
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
      } finally {
        controller.close()
      }
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
