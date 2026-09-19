import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LogExpenseModal } from './LogExpenseModal'
import { suggestCategoryLLM } from '../lib/autoCategory'

vi.mock('../api/expenses', () => ({ addExpense: vi.fn() }))
vi.mock('../api/categoryMap', () => ({ getCategoryMap: vi.fn(async () => ({ words: {}, updatedAt: '' })) }))
vi.mock('../lib/autoCategory', () => ({ suggestCategoryLLM: vi.fn() }))
vi.mock('../hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ name: 'Groceries' }, { name: 'Rent' }, { name: 'Eating out' }] }),
}))
vi.mock('@/src/context/CurrencyContext', () => ({ useCurrency: () => ({ currencySymbol: '₹' }) }))
vi.mock('./CategoryPicker', () => ({ CategoryPicker: ({ value }: { value: string }) => <output aria-label="Category">{value}</output> }))
vi.mock('./DatePicker', () => ({ DatePicker: () => null }))

const llm = vi.mocked(suggestCategoryLLM)
const type = (value: string) => fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value } })
const category = () => screen.getByLabelText('Category').textContent

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => llm.mockReset())

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
