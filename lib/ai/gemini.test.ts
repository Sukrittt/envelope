import { describe, it, expect, vi, beforeEach } from 'vitest'

const logMock = vi.fn(async () => undefined)
const generateContentStream = vi.fn()

vi.mock('./usage', () => ({ logAiUsage: (...args: unknown[]) => logMock(...(args as [])) }))
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream }
  },
}))

process.env.GEMINI_API_KEY = 'test'
const { streamText } = await import('./gemini')
const caller = { userId: 'user_1', feature: 'chat' as const }

async function* chunks() {
  yield { text: 'a' }
  yield { text: 'b', usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
}

beforeEach(() => vi.clearAllMocks())

describe('streamText usage logging', () => {
  it('logs the final chunk usage once the stream is consumed', async () => {
    generateContentStream.mockResolvedValue(chunks())
    const texts: string[] = []
    for await (const c of await streamText('sys', [], caller)) texts.push(c.text ?? '')
    expect(texts).toEqual(['a', 'b'])
    expect(logMock).toHaveBeenCalledTimes(1)
    expect(logMock).toHaveBeenCalledWith(caller, expect.any(String), expect.any(Number), { promptTokenCount: 10, candidatesTokenCount: 5 }, null)
  })

  it('still logs when the consumer stops early', async () => {
    generateContentStream.mockResolvedValue(chunks())
    for await (const _ of await streamText('sys', [], caller)) break
    expect(logMock).toHaveBeenCalledTimes(1)
  })

  it('logs a failed request start and rethrows', async () => {
    generateContentStream.mockRejectedValue(new Error('quota'))
    await expect(streamText('sys', [], caller)).rejects.toThrow('quota')
    expect(logMock).toHaveBeenCalledWith(caller, expect.any(String), expect.any(Number), undefined, expect.any(Error))
  })
})
