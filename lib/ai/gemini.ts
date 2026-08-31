import { GoogleGenAI, type Schema } from '@google/genai'

/**
 * Single source of truth for Gemini client setup — both the category-suggest
 * fallback (Feature 3) and the AI transaction-scan feature import from here.
 */

const MODEL = 'gemini-3.1-flash-lite'

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

/**
 * Same structured-output call as generateJSON, but with an image part attached
 * ahead of the prompt text — used by the bill-scan route. `image.data` is raw
 * base64 (no `data:` prefix).
 */
export async function generateJSONFromImage<T>(
  prompt: string,
  image: { data: string; mimeType: string },
  responseSchema: Schema,
): Promise<T> {
  const ai = getGeminiClient()
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ text: prompt }, { inlineData: { data: image.data, mimeType: image.mimeType } }],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  })
  const text = response.text
  if (!text) throw new Error('Gemini returned an empty response')
  return JSON.parse(text) as T
}

/**
 * Streaming chat call for the money-brain chat route. Returns the async
 * iterable stream directly — callers `for await` over it and read `.text`
 * off each chunk (same shape as the non-streaming response's `.text`).
 */
export async function streamText(
  systemInstruction: string,
  contents: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }>,
  maxOutputTokens = 700,
) {
  const ai = getGeminiClient()
  return ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction,
      temperature: 0.4,
      maxOutputTokens,
    },
  })
}
