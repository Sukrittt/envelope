import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from './Select'

const OPTIONS = [
  { value: 'food', label: 'Food' },
  { value: 'rent', label: 'Rent', disabled: true },
  { value: 'fun', label: 'Fun' },
]

function setup(value = '') {
  const onChange = vi.fn()
  render(<Select value={value} onChange={onChange} options={OPTIONS} placeholder="Assign to" aria-label="Category" />)
  return { onChange, trigger: screen.getByRole('combobox', { name: 'Category' }) }
}

describe('Select', () => {
  it('shows the placeholder, then opens a listbox and picks an option', () => {
    const { onChange, trigger } = setup()
    expect(trigger.textContent).toContain('Assign to')
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Fun' }))
    expect(onChange).toHaveBeenCalledWith('fun')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows the selected label and marks it selected', () => {
    const { trigger } = setup('food')
    expect(trigger.textContent).toContain('Food')
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Food' }).getAttribute('aria-selected')).toBe('true')
  })

  it('navigates by keyboard, skipping disabled options', () => {
    const { onChange, trigger } = setup('food')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('fun')
  })

  it('closes on Escape without changing', () => {
    const { onChange, trigger } = setup('food')
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ignores disabled options and a disabled trigger', () => {
    const { onChange, trigger } = setup()
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Rent' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
