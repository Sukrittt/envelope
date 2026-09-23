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

describe('streamText retries', () => {
  it('retries once when Gemini answers 503 UNAVAILABLE', async () => {
    generateContentStream.mockRejectedValueOnce(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'))
    generateContentStream.mockResolvedValueOnce(chunks())

    const texts: string[] = []
    for await (const c of await streamText('sys', [], caller)) texts.push(c.text ?? '')

    expect(texts).toEqual(['a', 'b'])
    expect(generateContentStream).toHaveBeenCalledTimes(2)
    // One call, one usage row: the retry is part of the same request.
    expect(logMock).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 too', async () => {
    generateContentStream.mockRejectedValueOnce(new Error('got status: 429 RESOURCE_EXHAUSTED'))
    generateContentStream.mockResolvedValueOnce(chunks())
    for await (const _ of await streamText('sys', [], caller)) break
    expect(generateContentStream).toHaveBeenCalledTimes(2)
  })

  it('gives up after the retry and logs the failure', async () => {
    generateContentStream.mockRejectedValue(new Error('503 UNAVAILABLE'))
    await expect(streamText('sys', [], caller)).rejects.toThrow('503')
    expect(generateContentStream).toHaveBeenCalledTimes(2)
    expect(logMock).toHaveBeenCalledWith(caller, expect.any(String), expect.any(Number), undefined, expect.any(Error))
  })

  it('does not retry an error that will not fix itself', async () => {
    generateContentStream.mockRejectedValue(new Error('400 INVALID_ARGUMENT'))
    await expect(streamText('sys', [], caller)).rejects.toThrow('400')
    expect(generateContentStream).toHaveBeenCalledTimes(1)
  })
})
