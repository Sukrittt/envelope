import { beforeEach, expect, it, vi } from 'vitest'
const { evaluate, log } = vi.hoisted(() => ({ evaluate: vi.fn(), log: vi.fn() }))
vi.mock('ai', () => ({ experimental_evaluate: evaluate }))
vi.mock('next/server', () => ({ after: (fn: () => void) => fn() }))
vi.mock('./usage', () => ({ logAiUsage: log }))
vi.mock('../systemSettings', () => ({ getSystemSettings: async () => ({ aiDisabled: false }) }))
import { evaluateRecurring, buildRecurringEvaluation, MAX_JEV_INPUT_BYTES } from './recurringDetection'
const candidate = { fingerprint: 'x', currency: 'INR', payments: [] }
const caller = { userId: 'u', feature: 'suggest' as const }
const answer = (pattern = 'subscription', frequency = 'monthly', probability = 0.95) => ({ usage: {}, answers: { pattern: { choice: pattern, probabilities: { [pattern]: probability } }, cadence: { choice: frequency, probabilities: { [frequency]: probability } } } })
beforeEach(() => vi.clearAllMocks())
it('accepts supported confident decisions and logs usage', async () => {
  evaluate.mockResolvedValue(answer())
  expect(await evaluateRecurring(candidate, caller)).toEqual({ pattern: 'subscription', frequency: 'monthly' })
  expect(log).toHaveBeenCalled()
  expect(evaluate.mock.calls[0][0].providerOptions.gateway.disallowPromptTraining).toBe(true)
})
it('accepts quarterly cadence only for subscriptions', async () => {
  evaluate.mockResolvedValue(answer('subscription', 'quarterly'))
  expect(await evaluateRecurring(candidate, caller)).toEqual({ pattern: 'subscription', frequency: 'quarterly' })
  evaluate.mockResolvedValue(answer('other_recurring', 'quarterly'))
  expect(await evaluateRecurring(candidate, caller)).toBeNull()
})
it('abstains for repeat purchases, unsupported cadence, or low probability', async () => {
  for (const value of [answer('repeat_purchase'), answer('subscription', 'other'), answer('subscription', 'monthly', 0.7)]) {
    evaluate.mockResolvedValue(value)
    expect(await evaluateRecurring(candidate, caller)).toBeNull()
  }
})
it('does not turn missing probabilities or failed calls into cacheable negative results', async () => {
  evaluate.mockResolvedValue({ usage: {}, answers: { pattern: { choice: 'subscription' }, cadence: { choice: 'monthly' } } })
  await expect(evaluateRecurring(candidate, caller)).rejects.toThrow()
  evaluate.mockRejectedValue(new Error('timeout'))
  await expect(evaluateRecurring(candidate, caller)).rejects.toThrow('timeout')
})

it('bounds the complete UTF-8 state and question payload, including hostile long text', () => {
  const payments = Array.from({ length: 36 }, (_, i) => ({ id: String(i), version: 0, date: `2026-09-${String(i % 28 + 1).padStart(2, '0')}`, item: '🧾'.repeat(10000), amount: 600, category: '\"\n'.repeat(10000), paymentMethod: 'bank', notes: '漢'.repeat(10000) }))
  const payload = buildRecurringEvaluation({ ...candidate, payments })
  expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(MAX_JEV_INPUT_BYTES)
  expect(payload.state.payments.length).toBeGreaterThanOrEqual(3)
  expect(payload.state.payments.length).toBeLessThanOrEqual(12)
  expect(payload.questions.pattern).toBeDefined()
  expect(payload.state.payments[0]).not.toHaveProperty('id')
  expect(() => buildRecurringEvaluation({ ...candidate, payments }, 100)).toThrow()
})

it('allows two observations and small payment-date shifts when asking about cadence', () => {
  const payload = buildRecurringEvaluation({ ...candidate, currency: 'INR', payments: ['2026-08-04', '2026-09-03'].map((date, i) => ({ id: String(i), version: 0, date, item: 'Rent', amount: 5000, category: 'Rent', notes: '', paymentMethod: 'bank' })) })
  expect(payload.state.payments).toHaveLength(2)
  expect(payload.questions.cadence.instructions).toContain('Two payments roughly one calendar month apart support monthly cadence')
  expect(payload.questions.cadence.instructions).toContain('Do not infer cadence from merchant identity alone')
})
