import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LogExpenseModal } from './LogExpenseModal'
import { suggestCategoryLLM } from '../lib/autoCategory'

const { addExpenseMutation, history } = vi.hoisted(() => ({ addExpenseMutation: vi.fn(), history: { rows: [] as unknown[] } }))
vi.mock('../hooks/useExpenses', () => ({
  useAddExpense: () => ({ mutateAsync: addExpenseMutation }),
  useExpenses: () => ({ data: history.rows }),
}))
vi.mock('../api/categoryMap', () => ({ getCategoryMap: vi.fn(async () => ({ words: {}, updatedAt: '' })) }))
vi.mock('../lib/autoCategory', () => ({ suggestCategoryLLM: vi.fn() }))
vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ name: 'Groceries' }, { name: 'Rent' }, { name: 'Eating out' }] }),
}))
vi.mock('@/src/context/CurrencyContext', () => ({ useCurrency: () => ({ currencySymbol: '₹', formatMoney: (n: number) => `₹${n}` }) }))
vi.mock('./CategoryPicker', () => ({
  CategoryPicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <>
      <output aria-label="Category">{value}</output>
      <button type="button" onClick={() => onChange(history.rows.length ? '🛒 Groceries' : 'Groceries')}>Choose Groceries</button>
    </>
  ),
}))
vi.mock('./DatePicker', () => ({ DatePicker: () => null }))

const llm = vi.mocked(suggestCategoryLLM)
const type = (value: string) => fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value } })
const category = () => screen.getByLabelText('Category').textContent

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  llm.mockReset().mockResolvedValue('')
  addExpenseMutation.mockReset()
  history.rows = []
})

it('saves through the expense mutation so Activity is invalidated immediately', async () => {
  addExpenseMutation.mockResolvedValue({ id: 'expense-1', pending: false })
  const onSaved = vi.fn()
  render(<LogExpenseModal onClose={vi.fn()} onSaved={onSaved} />)

  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '450' } })
  type('Milk')
  fireEvent.click(screen.getByRole('button', { name: 'Choose Groceries' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save expense' }))

  await waitFor(() => expect(addExpenseMutation).toHaveBeenCalledWith(expect.objectContaining({
    item: 'Milk',
    amount_inr: '450',
    category: 'Groceries',
  })))
  expect(onSaved).toHaveBeenCalledOnce()
})

describe('LogExpenseModal category suggestion', () => {
  it('leaves the category empty when nothing fits, instead of defaulting to the first one', async () => {
    llm.mockResolvedValue('')
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    type('Travel')
    await waitFor(() => expect(llm).toHaveBeenCalled())
    expect(category()).toBe('')
  })

  it('ignores a slow reply for text the user has since changed', async () => {
    const old = deferred<string>()
    llm.mockReturnValueOnce(old.promise).mockResolvedValueOnce('Rent')
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    type('house')
    await waitFor(() => expect(llm).toHaveBeenCalledTimes(1))
    type('house rent')
    await waitFor(() => expect(category()).toBe('Rent'))
    old.resolve('Groceries')
    await new Promise((r) => setTimeout(r, 50))
    expect(category()).toBe('Rent')
  })

  it('does not ask for one or two letters', async () => {
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    type('Tr')
    await new Promise((r) => setTimeout(r, 400))
    expect(llm).not.toHaveBeenCalled()
  })

  it('asks again after a failed request instead of remembering it', async () => {
    llm.mockResolvedValueOnce(null).mockResolvedValueOnce('Rent')
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    type('flat rent')
    await waitFor(() => expect(llm).toHaveBeenCalledTimes(1))
    type('flat')
    type('flat rent')
    await waitFor(() => expect(category()).toBe('Rent'))
  })

  it('reuses an earlier answer for the same text without another request', async () => {
    llm.mockResolvedValue('Eating out')
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    type('momo stall')
    await waitFor(() => expect(category()).toBe('Eating out'))
    type('momo')
    type('momo stall')
    expect(category()).toBe('Eating out')
    await new Promise((r) => setTimeout(r, 400))
    expect(llm).toHaveBeenCalledTimes(1)
  })
})

describe('LogExpenseModal typo guard', () => {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // Eight Groceries runs of 40..75: 450 is ~8x the median and beats them all.
  const seed = () => {
    history.rows = [40, 45, 50, 55, 60, 65, 70, 75].map((a) => ({ date: today, amount_inr: String(a), category: '🛒 Groceries' }))
  }
  const fill = (amount: string) => {
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } })
    type('Milk')
    fireEvent.click(screen.getByRole('button', { name: 'Choose Groceries' }))
  }

  it('warns once with the clean category name, then saves from the relabelled button', async () => {
    addExpenseMutation.mockResolvedValue({ id: 'expense-1', pending: false })
    seed()
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    fill('450')
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }))

    expect((await screen.findByRole('alert')).textContent).toBe("That's 8× your usual Groceries (₹58)")
    expect(addExpenseMutation).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save ₹450 anyway' }))
    await waitFor(() => expect(addExpenseMutation).toHaveBeenCalledOnce())
  })

  it('drops the warning once the amount is fixed', async () => {
    seed()
    render(<LogExpenseModal onClose={vi.fn()} onSaved={vi.fn()} />)
    fill('450')
    fireEvent.click(screen.getByRole('button', { name: 'Save expense' }))
    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '45' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
