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
 * Asks Jev a single choice question over `options`, returning the pick or ''
 * when Jev isn't confident — callers treat '' as "no suggestion".
 */
async function pickChoice(
  answerKey: string,
  instructions: string,
  state: Record<string, string>,
  options: string[],
  caller: AiCaller,
): Promise<string> {
  if ((await getSystemSettings()).aiDisabled) throw new Error(AI_DISABLED_MESSAGE)
  const startedAt = Date.now()
  try {
    const result = await evaluate({
      model: MODEL,
      state,
      questions: {
        [answerKey]: {
          type: 'choice',
          instructions,
          criteria: Object.fromEntries(options.map((c) => [c, null])),
        },
      },
      // zeroDataRetention would be stronger but needs Vercel Pro (403 on Hobby).
      providerOptions: { gateway: { disallowPromptTraining: true } },
    })
    after(() => logAiUsage(caller, MODEL, startedAt, {
      promptTokenCount: result.usage.inputTokens,
      candidatesTokenCount: result.usage.outputTokens,
    }, null))

    const { choice, probabilities } = result.answers[answerKey]
    if (!options.includes(choice)) return ''
    if (probabilities && (probabilities[choice] ?? 0) < MIN_CONFIDENCE) return ''
    return choice
  } catch (err) {
    after(() => logAiUsage(caller, MODEL, startedAt, undefined, err))
    throw err
  }
}

/** Picks the best-fit category for an expense item from the user's own list. */
export async function pickCategory(item: string, categories: string[], caller: AiCaller): Promise<string> {
  return pickChoice(
    'category',
    'Which personal budgeting category does this expense item belong to?',
    { expenseItem: item },
    categories,
    caller,
  )
}

/** Picks the best-fit investment type for a holding name from the app's fixed type list. */
export async function pickHoldingType(name: string, types: string[], caller: AiCaller): Promise<string> {
  return pickChoice(
    'holdingType',
    'Which investment holding type does this holding name belong to?',
    { holdingName: name },
    types,
    caller,
  )
}
