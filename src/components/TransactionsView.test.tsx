import { fireEvent, render, screen } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { TransactionsView } from './TransactionsView'
import { ExpenseWriteError } from '../lib/expenseConflict'
const { remove } = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../hooks/useBudgets', () => ({ useBudgets: () => ({ data: [] }) }))
vi.mock('../hooks/useRecentCategories', () => ({ useRecentCategories: () => ({ recents: [] }) }))
vi.mock('../hooks/useExpenses', () => ({
  useExpensesPage: () => ({ data: { rows: [{ id: 'one', version: 0, timestamp: '2026-09-18T10:00:00', date: '2026-09-18', item: 'Lunch', amount_inr: '100', category: 'Food' }], total: 1, pageCount: 1, totalAmount: 100 } }),
  useDeleteExpense: () => ({ mutateAsync: remove }),
}))

it('opens the transaction actions when the row is clicked', () => {
  render(<TransactionsView />)
  expect(screen.getByText('₹100', { selector: '.txn-timeline-amount' })).not.toHaveClass('is-expense')
  fireEvent.click(screen.getByRole('button', { name: 'Open actions for Lunch' }))
  expect(screen.getByText('Edit transaction')).toBeInTheDocument()
  expect(screen.getByText('Delete transaction')).toBeInTheDocument()
})

it('separates filters from date-grouped transaction rows', () => {
  render(<TransactionsView />)

  expect(screen.getByRole('heading', { name: 'Activity', level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Activity filters' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Filter by category' })).toHaveTextContent('All categories')
  expect(screen.getByRole('searchbox', { name: 'Search transactions' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /18 September 2026/, level: 2 })).toBeInTheDocument()
  expect(screen.getByText('1 transaction', { selector: '.txn-timeline-header-count' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: 'This month' }))
  expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
})

it.each([[409, 'This transaction was updated'], [404, 'This transaction is already deleted']])('opens a friendly dialog after a delete returns %s', async (status, title) => {
  remove.mockReset().mockRejectedValueOnce(new ExpenseWriteError(Number(status), 'Raw API error'))
  render(<TransactionsView />)
  fireEvent.click(screen.getByRole('button', { name: 'Open actions for Lunch' }))
  fireEvent.click(screen.getByText('Delete transaction'))
  fireEvent.click(screen.getByText('Remove'))
  await screen.findByRole('dialog', { name: String(title) })
  expect(screen.queryByText('Raw API error')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Back to transactions'))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(remove).toHaveBeenCalledTimes(1)
})
