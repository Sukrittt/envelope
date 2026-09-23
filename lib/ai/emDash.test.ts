import { describe, expect, it } from 'vitest'
import { createEmDashScrubber, scrubEmDashes } from './emDash'

describe('scrubEmDashes', () => {
  it('turns a spaced or tight em dash into a comma', () => {
    expect(scrubEmDashes('Food is high — mostly takeout.')).toBe('Food is high, mostly takeout.')
    expect(scrubEmDashes('Food is high—mostly takeout.')).toBe('Food is high, mostly takeout.')
  })

  it('leaves en dashes in ranges alone', () => {
    expect(scrubEmDashes('₹1,000–2,000 a week')).toBe('₹1,000–2,000 a week')
  })

  it('drops a dash that ends a line instead of leaving a stray comma', () => {
    expect(scrubEmDashes('Top three —\n- Rent')).toBe('Top three\n- Rent')
  })
})

describe('createEmDashScrubber', () => {
  const run = (chunks: string[]) => {
    const scrub = createEmDashScrubber()
    return chunks.map((c) => scrub.push(c)).join('') + scrub.flush()
  }

  it('scrubs a dash split across stream chunks without doubling spaces', () => {
    expect(run(['Food is high ', '— mostly', ' takeout.'])).toBe('Food is high, mostly takeout.')
    expect(run(['Food is high —', ' mostly takeout.'])).toBe('Food is high, mostly takeout.')
    expect(run(['Food is high', ' ', '—', ' ', 'mostly'])).toBe('Food is high, mostly')
  })

  it('passes clean text through unchanged, including trailing whitespace', () => {
    expect(run(['You have ', '**₹1,000** left.\n', '\n- Rent'])).toBe('You have **₹1,000** left.\n\n- Rent')
  })
})
