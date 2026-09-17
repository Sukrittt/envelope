import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MoneyBrainDrawer } from './MoneyBrainDrawer'

const state = vi.hoisted(() => ({ hidden: false }))
vi.mock('../hooks/useBudgets', () => ({ useBudgets: () => ({ data: [] }) }))
vi.mock('../hooks/useExpenses', () => ({ useExpenses: () => ({ data: [] }) }))
vi.mock('../hooks/useCategories', () => ({ useCategories: () => ({ data: [] }) }))
vi.mock('../hooks/useGroups', () => ({ useGroups: () => ({ data: [] }) }))
vi.mock('../hooks/useHideAmounts', () => ({ useHideAmounts: () => [state.hidden] }))
vi.mock('../hooks/useChatSessions', () => ({ useChatSessions: () => ({}), useChatSessionsCount: () => ({ data: 5 }) }))
vi.mock('../hooks/useMoneyBrief', () => ({ useMoneyBrief: () => ({ data: {
  narrative: 'Your monthly brief.', meta: { txnCountThisMonth: 58 }, questions: [],
  cards: [{ title: 'Monthly Rent', subtitle: 'Largest single spend', icon: '🏠', amount: 12000, valueLabel: 'INR', tone: 'violet' }],
} }) }))
beforeEach(() => { state.hidden = false; Element.prototype.scrollTo = vi.fn() })
function show() {
  return render(<QueryClientProvider client={new QueryClient()}><MoneyBrainDrawer onClose={vi.fn()} /></QueryClientProvider>)
}
it('renders the actual insight amount alongside its label', () => {
  show()
  expect(screen.getByText('₹12,000')).toBeInTheDocument()
  expect(screen.getByText('INR')).toBeInTheDocument()
})
it('keeps insight amounts private when amounts are hidden', () => {
  state.hidden = true
  show()
  expect(screen.queryByText('₹12,000')).not.toBeInTheDocument()
})
it('uses a centered vector icon instead of a font glyph in the header', () => {
  const { container } = show()
  expect(container.querySelector('.brain-orbit svg')).not.toBeNull()
})
