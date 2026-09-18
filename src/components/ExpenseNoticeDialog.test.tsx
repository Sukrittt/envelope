import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExpenseNoticeDialog } from './ExpenseNoticeDialog'

describe('expense write notices', () => {
  it.each([[409, 'This transaction was updated'], [404, 'This transaction is already deleted'], [undefined, 'We couldn’t confirm the deletion']] as const)('explains status %s and returns without retrying', (status, title) => {
    const onBack = vi.fn()
    render(<ExpenseNoticeDialog status={status} action="delete" onBack={onBack} />)
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Back to transactions' })
    expect(button).toHaveFocus()
    fireEvent.click(button)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
  it('supports keyboard dismissal', () => {
    const onBack = vi.fn()
    render(<ExpenseNoticeDialog status={409} action="delete" onBack={onBack} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
