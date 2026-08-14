import { GoogleGenAI, type Schema } from '@google/genai'

/**
 * Single source of truth for Gemini client setup — both the category-suggest
 * fallback (Feature 3) and the AI transaction-scan feature import from here.
 */

const MODEL = 'gemini-2.5-flash-lite'

let client: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (client) return client
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  client = new GoogleGenAI({ apiKey })
  return client
}

/**
 * Calls the model with Gemini's native structured-output mode (responseSchema
 * + responseMimeType: 'application/json') and parses the result as T. Relies
 * on the schema's own constraints (e.g. `enum`) rather than hand-validating
 * the parsed JSON afterward.
 */
export async function generateJSON<T>(prompt: string, responseSchema: Schema): Promise<T> {
  const ai = getGeminiClient()
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  })
  const text = response.text
  if (!text) throw new Error('Gemini returned an empty response')
  return JSON.parse(text) as T
}
