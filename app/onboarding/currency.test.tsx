import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SetupWizardPage from './page'
import { updateUser } from '@/src/api/account'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/src/api/budgets', () => ({ updateBudget: vi.fn(async () => ({})) }))
vi.mock('@/src/api/groups', () => ({ addGroup: vi.fn(async () => ({})) }))
vi.mock('@/src/api/categories', () => ({ addCategory: vi.fn(async () => ({})) }))
vi.mock('@/src/api/account', () => ({ updateUser: vi.fn(async patch => patch) }))

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  render(<QueryClientProvider client={client}><SetupWizardPage /></QueryClientProvider>)
  return client
}

describe('currency onboarding', () => {
  it('selects currency before income, preserves it going back, and saves on completion', async () => {
    const client = setup()
    expect(screen.getByRole('heading', { name: 'Choose your currency' })).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'USD' } })
    fireEvent.click(screen.getByRole('button', { name: /US Dollar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('$0')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByRole('button', { name: /US Dollar/ }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: '$50,000' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ currencyCode: 'USD', onboardedAt: expect.any(String) })))
    await waitFor(() => expect(client.getQueryData(['user'])).toEqual(expect.objectContaining({ currencyCode: 'USD' })))
    client.clear()
  })
})
