import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RecurringSuggestions } from './RecurringSuggestions'
import type { RecurringScan } from '../types/recurringSuggestions'
const mocks = vi.hoisted(() => ({ load: vi.fn(), scan: vi.fn(), dismiss: vi.fn() }))
vi.mock('../api/recurringSuggestions', () => ({ loadRecurringSuggestions: mocks.load, scanRecurringSuggestions: mocks.scan, dismissRecurringSuggestion: mocks.dismiss }))
vi.mock('./RecurringExpenseModal', () => ({ RecurringExpenseModal: ({ initialValues, onClose, onAdded }: { initialValues: { item: string; start_date: string }; onClose: () => void; onAdded: () => void }) => <div role="dialog"><p>{initialValues.item} starts {initialValues.start_date}</p><button onClick={onClose}>Cancel review</button><button onClick={() => { onAdded(); onClose() }}>Confirm addition</button></div> }))
const empty: RecurringScan = { suggestions: [], remaining: 1, scannedAt: null, windowStart: '2026-03-22', windowEnd: '2026-09-22' }
const found: RecurringScan = { ...empty, remaining: 0, scannedAt: '2026-09-22T10:00:00Z', suggestions: [{ id: 's1', kind: 'subscription', dates: ['2026-07-05','2026-08-05','2026-09-05'], occurrences: 3, variableAmount: false, input: { item: 'Netflix', amount_inr: '649', category: 'Entertainment', frequency: 'monthly', start_date: '2026-10-05' } }] }
function mount() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><RecurringSuggestions /></QueryClientProvider>) }
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockResolvedValue(empty); mocks.scan.mockResolvedValue(found); mocks.dismiss.mockResolvedValue(undefined) })
it('loads saved results without scanning, then opens a prefilled review only after a click', async () => {
  mount()
  const button = screen.getByRole('button', { name: 'Find recurring expenses' })
  await waitFor(() => expect(button).toBeEnabled())
  expect(mocks.scan).not.toHaveBeenCalled()
  fireEvent.click(button)
  expect(await screen.findByText('Netflix')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review and add' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Netflix starts 2026-10-05')
  fireEvent.click(screen.getByText('Cancel review'))
  expect(screen.getByText('Netflix')).toBeInTheDocument()
  expect(mocks.dismiss).not.toHaveBeenCalled()
})
it('dismisses only when requested and removes the card', async () => {
  mocks.load.mockResolvedValue(found)
  mount()
  fireEvent.click(await screen.findByText('Dismiss'))
  await waitFor(() => expect(screen.queryByText('Netflix')).not.toBeInTheDocument())
  expect(mocks.dismiss).toHaveBeenCalledWith('s1', expect.anything())
})
it('shows failures and keeps scanning available', async () => {
  mocks.scan.mockRejectedValue(new Error('Try again shortly'))
  mount()
  const button = screen.getByRole('button', { name: 'Find recurring expenses' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again shortly')
  expect(button).toBeEnabled()
})

it('selects shorter periods without calling Jev and submits the chosen period', async () => {
  mount()
  const selector = screen.getByRole('combobox', { name: 'Scan period' })
  await waitFor(() => expect(mocks.load).toHaveBeenCalledWith(6))
  fireEvent.change(selector, { target: { value: '1' } })
  await waitFor(() => expect(mocks.load).toHaveBeenCalledWith(1))
  expect(mocks.scan).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'Find recurring expenses' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  await waitFor(() => expect(mocks.scan).toHaveBeenCalledWith(1, expect.anything()))
})
