import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AmountTicker } from './AmountTicker'
import { CurrencyScope } from '@/src/context/CurrencyContext'

const ui = (text: string, tick: number, dir: 1 | -1 = 1, delta = 0) => (
  <CurrencyScope code="USD">
    <AmountTicker text={text} tick={tick} dir={dir} delta={delta} dimmed={false} />
  </CurrencyScope>
)

describe('AmountTicker', () => {
  it('rolls only the characters that changed and labels the whole amount', () => {
    const { container, rerender } = render(ui('$50', 1))
    rerender(ui('$500', 2))
    expect(screen.getByRole('img', { name: '$500' })).toBeTruthy()
    // "$500" vs "$50": the new trailing digit rolls, the other three sit still.
    expect(container.querySelectorAll('.amt-col').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.amt-col').length).toBeLessThan(4)
  })

  it('shows a delta badge only for quick-pick jumps', () => {
    const { container, rerender } = render(ui('$0', 0))
    expect(container.querySelector('.amt-delta')).toBeNull()
    rerender(ui('$50,000', 1, 1, 50000))
    expect(container.querySelector('.amt-delta')?.textContent).toContain('50,000')
  })
})
