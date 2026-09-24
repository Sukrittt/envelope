import { describe, it, expect, vi, beforeEach } from 'vitest'

const runJev = vi.fn()
vi.mock('./jev', () => ({ runJev: (...args: unknown[]) => runJev(...(args as [])) }))

const { rankBrief } = await import('./briefCards')
const caller = { userId: 'user_1', feature: 'brief' as const }

const cards = ['a', 'b', 'c', 'd', 'e'].map((title, i) => ({
  icon: '🔥', title, subtitle: 'sub', valueLabel: 'INR', amount: i, tone: 'mint' as const,
}))
const questions = ['q0', 'q1', 'q2', 'q3', 'q4', 'q5']

function scored(scores: Record<string, number>) {
  return Object.fromEntries(Object.entries(scores).map(([k, score]) => [k, { type: 'score', score }]))
}

beforeEach(() => vi.clearAllMocks())

describe('rankBrief', () => {
  it('asks one score question per candidate in a single Jev call', async () => {
    runJev.mockResolvedValue(scored({ card_0: 1, card_1: 3, card_2: 2, card_3: 0, card_4: 0, question_0: 3, question_1: 2, question_2: 1, question_3: 0, question_4: 0, question_5: 0 }))

    await rankBrief({ cards, questions }, 'FACTS', caller)

    expect(runJev).toHaveBeenCalledTimes(1)
    const asked = runJev.mock.calls[0][1]
    expect(Object.keys(asked)).toHaveLength(cards.length + questions.length)
    expect(Object.values(asked).every((q) => (q as { type: string }).type === 'score')).toBe(true)
  })

  it('returns the three best cards and four best questions, best first', async () => {
    runJev.mockResolvedValue(scored({ card_0: 1, card_1: 3, card_2: 2, card_3: 0, card_4: 0, question_0: 0, question_1: 3, question_2: 2, question_3: 1, question_4: 0.5, question_5: 0 }))

    const picked = await rankBrief({ cards, questions }, 'FACTS', caller)

    expect(picked.cards.map((c) => c.title)).toEqual(['b', 'c', 'a'])
    expect(picked.questions).toEqual(['q1', 'q2', 'q3', 'q4'])
  })

  it('falls back to the priority order when Jev fails, so the brief still renders', async () => {
    runJev.mockRejectedValue(new Error('gateway down'))

    const picked = await rankBrief({ cards, questions }, 'FACTS', caller)

    expect(picked.cards.map((c) => c.title)).toEqual(['a', 'b', 'c'])
    expect(picked.questions).toEqual(['q0', 'q1', 'q2', 'q3'])
  })

  it('scores an answer that is not a score as zero, leaving it on priority order', async () => {
    runJev.mockResolvedValue({ ...scored({ card_1: 3, card_2: 2 }), card_0: { type: 'choice', choice: 'x' } })

    const picked = await rankBrief({ cards, questions }, 'FACTS', caller)

    expect(picked.cards.map((c) => c.title)).toEqual(['b', 'c', 'a'])
  })
})
