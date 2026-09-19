import { describe, it, expect, vi, beforeEach } from 'vitest'

const logMock = vi.fn(async () => undefined)
const evaluate = vi.fn()

vi.mock('./usage', () => ({ logAiUsage: (...args: unknown[]) => logMock(...(args as [])) }))
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }))
vi.mock('ai', () => ({ experimental_evaluate: (...args: unknown[]) => evaluate(...args) }))
vi.mock('../systemSettings', () => ({
  AI_DISABLED_MESSAGE: 'AI is off',
  getSystemSettings: async () => ({ aiDisabled: false }),
}))

const { pickCategory } = await import('./jev')
const caller = { userId: 'user_1', feature: 'suggest' as const }
const usage = { inputTokens: 40, outputTokens: 1, totalTokens: 41 }

function answer(choice: string, probabilities?: Record<string, number>) {
  return { answers: { category: { type: 'choice', choice, probabilities } }, usage }
}

beforeEach(() => vi.clearAllMocks())

describe('pickCategory', () => {
  it('asks a choice question over exactly the given categories', async () => {
    evaluate.mockResolvedValue(answer('Food', { Food: 0.9, Travel: 0.1 }))
    await pickCategory('swiggy dinner', ['Food', 'Travel'], caller)
    const { model, questions } = evaluate.mock.calls[0][0]
    expect(model).toBe('typesafe-ai/jev')
    expect(questions.category.type).toBe('choice')
    expect(Object.keys(questions.category.criteria)).toEqual(['Food', 'Travel'])
    // Zero Data Retention needs Vercel Pro; the gateway 403s every call on Hobby.
    expect(evaluate.mock.calls[0][0].providerOptions).toEqual({ gateway: { disallowPromptTraining: true } })
  })

  it('returns the choice when it is confident', async () => {
    evaluate.mockResolvedValue(answer('Food', { Food: 0.9, Travel: 0.1 }))
    expect(await pickCategory('swiggy dinner', ['Food', 'Travel'], caller)).toBe('Food')
  })

  it('returns empty when no option clears the confidence bar', async () => {
    // Real Jev answer for the gibberish item "zxqv 42": Shopping at 0.62.
    evaluate.mockResolvedValue(answer('Shopping', { Shopping: 0.62, Food: 0.2, Travel: 0.18 }))
    expect(await pickCategory('zxqv 42', ['Shopping', 'Food', 'Travel'], caller)).toBe('')
  })

  it('trusts the choice when no distribution comes back', async () => {
    evaluate.mockResolvedValue(answer('Travel'))
    expect(await pickCategory('uber', ['Food', 'Travel'], caller)).toBe('Travel')
  })

  it('never returns a category outside the list', async () => {
    evaluate.mockResolvedValue(answer('Groceries', { Groceries: 1 }))
    expect(await pickCategory('milk', ['Food', 'Travel'], caller)).toBe('')
  })

  it('logs usage on success and on failure', async () => {
    evaluate.mockResolvedValue(answer('Food', { Food: 1 }))
    await pickCategory('pizza', ['Food'], caller)
    expect(logMock).toHaveBeenCalledWith(caller, 'typesafe-ai/jev', expect.any(Number), { promptTokenCount: 40, candidatesTokenCount: 1 }, null)

    evaluate.mockRejectedValue(new Error('gateway down'))
    await expect(pickCategory('pizza', ['Food'], caller)).rejects.toThrow('gateway down')
    expect(logMock).toHaveBeenLastCalledWith(caller, 'typesafe-ai/jev', expect.any(Number), undefined, expect.any(Error))
  })
})
