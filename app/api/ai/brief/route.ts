import { Type } from '@google/genai'
import { json, error } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { generateJSON } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

interface BriefCard {
  icon: string
  title: string
  subtitle: string
  valueLabel: string
  amount: number
  tone: 'mint' | 'violet' | 'coral' | 'warn'
}

interface Brief {
  narrative: string
  cards: BriefCard[]
  questions: string[]
}

export async function GET(req: Request) {
  const auth = await getAuth(req)

  try {
    const { facts, meta } = await buildExpenseContext(auth)

    const prompt = [
      'You are generating a short "money brief" for a personal expense-tracking dashboard, grounded strictly in the FACTS below.',
      'Write a 1-2 sentence narrative paragraph summarizing the month so far.',
      'Produce exactly 3 cards highlighting the most useful things to surface right now — e.g. the heaviest envelope, the largest single spend, the easiest place to cut back — pick whichever 3 are most relevant given the FACTS.',
      'Produce exactly 4 short suggested follow-up questions the user might tap to ask next.',
      'Every number you use must come directly from FACTS; never estimate or invent a figure.',
      '',
      'FACTS:',
      facts,
    ].join('\n')

    const brief = await generateJSON<Brief>(prompt, {
      type: Type.OBJECT,
      properties: {
        narrative: { type: Type.STRING },
        cards: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              icon: { type: Type.STRING },
              title: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              valueLabel: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              tone: { type: Type.STRING, enum: ['mint', 'violet', 'coral', 'warn'] },
            },
            required: ['icon', 'title', 'subtitle', 'valueLabel', 'amount', 'tone'],
          },
        },
        questions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['narrative', 'cards', 'questions'],
    })

    return json({ ...brief, meta })
  } catch (err) {
    console.error('brief: failed', err)
    return error('brief unavailable', 502)
  }
}
