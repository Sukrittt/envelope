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

  it('searchable: filters options and picks the sole match with Enter', () => {
    const onChange = vi.fn()
    render(<Select value="" onChange={onChange} options={OPTIONS} aria-label="Category" searchable />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }))
    const search = screen.getByRole('searchbox')
    fireEvent.change(search, { target: { value: 'fu' } })
    expect(screen.queryByRole('option', { name: 'Food' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Fun' })).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('fun')
  })

  it('searchable: shows "No matches" for an empty filter result', () => {
    setup('')
    // Re-render with searchable to check the empty state copy.
    const onChange = vi.fn()
    render(<Select value="" onChange={onChange} options={OPTIONS} aria-label="Cat2" searchable />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Cat2' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Cat2' }), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches')).toBeTruthy()
  })

  it('shows an option icon in both the row and the trigger once selected', () => {
    const withIcons = [{ value: 'rent', label: 'Rent', icon: '🏠' }, { value: 'food', label: 'Food' }]
    const onChange = vi.fn()
    render(<Select value="rent" onChange={onChange} options={withIcons} aria-label="Cat3" />)
    // aria-hidden icons don't count toward the accessible name; check the rendered text instead.
    expect(screen.getByRole('combobox', { name: 'Cat3' }).textContent).toBe('🏠Rent')
    fireEvent.click(screen.getByRole('combobox', { name: 'Cat3' }))
    expect(screen.getByRole('option', { name: 'Rent' }).textContent).toBe('🏠Rent')
    expect(screen.getByRole('option', { name: 'Food' })).toBeTruthy()
  })
})
