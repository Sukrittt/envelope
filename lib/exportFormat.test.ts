import { describe, it, expect } from 'vitest'
import { exportColumns } from './exportFormat'
import { buildSystemPrompt } from './ai/moneyBrainPrompt'

describe('server currency presentation', () => {
  it('formats export headers and money without changing source values', () => {
    const source = { amount_inr: '123456.78' }
    const columns = exportColumns('AED')
    const amount = columns.expenses!.find(c => c.key === 'amount_inr')!
    expect(amount.label).toBe('Amount (AED)')
    expect(amount.format!(source.amount_inr)).toBe('AED 123,456.78')
    expect(source.amount_inr).toBe('123456.78')
    expect(exportColumns('USD').budgets!.find(c => c.key === 'assigned')!.format!('500')).toBe('$500')
  })
  it('instructs AI to use the selected currency without conversion', () => {
    const prompt = buildSystemPrompt('amount_inr: 500', 'EUR')
    expect(prompt).toContain('EUR')
    expect(prompt).toContain('€')
    expect(prompt).toContain('never convert amounts')
    expect(prompt).not.toContain('Indian Rupees')
  })
})
