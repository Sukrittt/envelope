import { describe, it, expect } from 'vitest'
import { estimateCostUsd } from './pricing'

describe('estimateCostUsd', () => {
  it('prices input, output and thinking tokens for flash-lite', () => {
    // 1M input × $0.25 + (500k output + 500k thinking) × $1.50
    expect(estimateCostUsd('gemini-3.1-flash-lite', { inputTokens: 1_000_000, outputTokens: 500_000, thinkingTokens: 500_000 })).toBeCloseTo(1.75, 10)
  })

  it('is zero for no tokens', () => {
    expect(estimateCostUsd('gemini-3.1-flash-lite', { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 })).toBe(0)
  })

  it('returns null for a model without a price entry', () => {
    expect(estimateCostUsd('some-new-model', { inputTokens: 10, outputTokens: 10, thinkingTokens: 0 })).toBeNull()
  })
})
