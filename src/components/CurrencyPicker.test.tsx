import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyPicker } from './CurrencyPicker'
import { CurrencyScope, useCurrency } from '@/src/context/CurrencyContext'

describe('currency picker', () => {
  it('searches by code and selects a currency', () => {
    const onChange = vi.fn()
    render(<CurrencyPicker value="INR" onChange={onChange} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: /US Dollar/ }))
    expect(onChange).toHaveBeenCalledWith('USD')
    expect(screen.queryByRole('button', { name: /Indian Rupee/ })).toBeNull()
  })
  it('updates mounted amounts when the preference changes', () => {
    function Amount() { const { formatCurrency } = useCurrency(); return <span>{formatCurrency(500)}</span> }
    const { rerender } = render(<CurrencyScope code="INR"><Amount /></CurrencyScope>)
    expect(screen.getByText('₹500')).toBeTruthy()
    rerender(<CurrencyScope code="AED"><Amount /></CurrencyScope>)
    expect(screen.getByText('AED 500')).toBeTruthy()
  })
})
