import { experimental_evaluate as evaluate } from 'ai'
import { after } from 'next/server'
import { logAiUsage, type AiCaller } from './usage'
import { AI_DISABLED_MESSAGE, getSystemSettings } from '../systemSettings'

/**
 * Jev (TypeSafe AI, via Vercel AI Gateway) answers typed choice/score/boolean
 * questions with probabilities instead of generating text — far faster and
 * cheaper than Gemini for pure decisions. Auth is AI_GATEWAY_API_KEY, read by
 * the gateway provider itself.
 */
const MODEL = 'typesafe-ai/jev'

// Real items came back at 1.00 in a live check; gibberish ("zxqv 42") still scored 0.62.
// ponytail: calibrated on a handful of items; retune from override quality once real traffic lands.
const MIN_CONFIDENCE = 0.8

/**
 * Must be called inside a request: the usage record is written with `after()`
 * so its database round trip never delays the reply.
 *
 * Picks the best-fit category for an expense item from the user's own list,
 * or '' when Jev isn't confident — callers treat '' as "no suggestion", so a
 * shaky guess never gets written into the category map.
 */
export async function pickCategory(item: string, categories: string[], caller: AiCaller): Promise<string> {
  if ((await getSystemSettings()).aiDisabled) throw new Error(AI_DISABLED_MESSAGE)
  const startedAt = Date.now()
  try {
    const result = await evaluate({
      model: MODEL,
      state: { expenseItem: item },
      questions: {
        category: {
          type: 'choice',
          instructions: 'Which personal budgeting category does this expense item belong to?',
          criteria: Object.fromEntries(categories.map((c) => [c, null])),
        },
      },
      // zeroDataRetention would be stronger but needs Vercel Pro (403 on Hobby).
      providerOptions: { gateway: { disallowPromptTraining: true } },
    })
    after(() => logAiUsage(caller, MODEL, startedAt, {
      promptTokenCount: result.usage.inputTokens,
      candidatesTokenCount: result.usage.outputTokens,
    }, null))

    const { choice, probabilities } = result.answers.category
    if (!categories.includes(choice)) return ''
    if (probabilities && (probabilities[choice] ?? 0) < MIN_CONFIDENCE) return ''
    return choice
  } catch (err) {
    after(() => logAiUsage(caller, MODEL, startedAt, undefined, err))
    throw err
  }
}
