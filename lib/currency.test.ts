import { it, expect } from 'vitest'
import { formatCurrency } from './currency'
it('suppresses negative zero', () => expect(formatCurrency(-0.004)).toBe('₹0'))
