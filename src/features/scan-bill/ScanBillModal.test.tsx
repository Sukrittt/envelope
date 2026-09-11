import { it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ScanBillModal } from './ScanBillModal'
import { scanBill } from '@/src/api/scan'
import { saveBillScan } from '@/src/api/bills'
import { postExpensePayload } from '@/src/api/expenses'

vi.mock('@/src/api/scan', () => ({ scanBill: vi.fn() }))
vi.mock('@/src/api/bills', () => ({ saveBillScan: vi.fn() }))
vi.mock('@/src/api/categories', () => ({ getCategories: vi.fn().mockResolvedValue([{ name: 'Groceries', group: 'Home' }]) }))
vi.mock('@/src/api/groups', () => ({ getGroups: vi.fn().mockResolvedValue(['Home']) }))
vi.mock('@/src/api/expenses', async (importActual) => ({
  ...(await importActual<typeof import('@/src/api/expenses')>()),
  getExpenses: vi.fn().mockResolvedValue([]),
  postExpensePayload: vi.fn(),
}))
// jsdom has no canvas or createImageBitmap; the encoding is the browser's job.
vi.mock('./image', () => ({
  dataUrlFromFile: vi.fn().mockResolvedValue('data:image/jpeg;base64,QUJD'),
  dataUrlFromVideo: vi.fn(),
  base64Of: (url: string) => url.slice(url.indexOf(',') + 1),
}))

it('pastes a bill, splits it, logs the share and saves the scan without blank rows', async () => {
  ;(scanBill as Mock).mockResolvedValue({
    merchant: 'Blinkit',
    total: 112,
    category: 'Groceries',
    date: '2026-09-10',
    items: [
      { name: 'Milk', price: 60, qty: 1 },
      { name: 'Bread', price: 40, qty: 1 },
      { name: 'Delivery fee', price: 12, qty: 1 },
    ],
  })
  ;(postExpensePayload as Mock).mockResolvedValue({ id: 'exp1', timestamp: 't' })
  ;(saveBillScan as Mock).mockResolvedValue(undefined)
  const onClose = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<ScanBillModal onClose={onClose} onEnterManually={vi.fn()} />, {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })

  const file = new File(['x'], 'bill.png', { type: 'image/png' })
  const paste = new Event('paste') as Event & { clipboardData: { files: File[] } }
  paste.clipboardData = { files: [file] }
  await act(async () => {
    window.dispatchEvent(paste)
  })

  await screen.findByText('Fees & discount')
  // mock.calls[0][0], not toHaveBeenCalledWith: react-query passes the mutation context as a second argument.
  expect((scanBill as Mock).mock.calls[0][0]).toEqual({ image: 'QUJD', mimeType: 'image/jpeg', categories: ['Groceries'] })

  // Bread split two ways: 60 + 20 of the products, plus half the 12 fee.
  await userEvent.click(screen.getAllByRole('button', { name: '÷2' })[1])
  await userEvent.click(screen.getByRole('button', { name: '+ Add item' }))
  await userEvent.click(screen.getByRole('button', { name: 'Review ₹86 →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Log ₹86 to Groceries' }))

  await waitFor(() => expect(saveBillScan).toHaveBeenCalled())
  expect((postExpensePayload as Mock).mock.calls[0][0]).toMatchObject({ item: 'Blinkit', amount_inr: '86', category: 'Groceries', date: '2026-09-10' })
  const saved = (saveBillScan as Mock).mock.calls[0][0]
  expect(saved).toMatchObject({ expense_id: 'exp1', total: 112, my_share: 86, people_count: 2 })
  expect(saved.items.map((i: { name: string }) => i.name)).toEqual(['Milk', 'Bread', 'Delivery fee'])
})
