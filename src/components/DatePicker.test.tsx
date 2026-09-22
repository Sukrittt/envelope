import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { DatePicker } from './DatePicker'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 22)) // Sat 22 Aug 2026
})
afterEach(() => {
  vi.useRealTimers()
})

function ControlledSingle({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState('2026-08-19')
  return (
    <DatePicker
      mode="single"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

it('allows a later day in the current month but blocks days in a future month', () => {
  const onChange = vi.fn()
  render(<ControlledSingle onChange={onChange} />)
  fireEvent.click(screen.getByText('Wednesday, 19 Aug 2026'))

  // 25 Aug is after "today" (22 Aug) but still the current month: pickable.
  fireEvent.click(screen.getByText('25'))
  expect(onChange).toHaveBeenCalledWith('2026-08-25')

  // Single-select closes the card on pick; reopen it to navigate months.
  onChange.mockClear()
  fireEvent.click(screen.getByText('Tuesday, 25 Aug 2026'))
  fireEvent.click(screen.getByLabelText('Next month')) // nav to September 2026
  expect(screen.getByText('September 2026')).toBeTruthy()
  const septFifth = screen.getByText('5').closest('button')!
  expect(septFifth).toBeDisabled()
  fireEvent.click(septFifth)
  expect(onChange).not.toHaveBeenCalled()
})
