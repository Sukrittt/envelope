import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { apiFetch } from './client'
import { transferBudget } from './budgets'

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}))

const mockedApiFetch = apiFetch as Mock

beforeEach(() => {
  mockedApiFetch.mockReset()
})

describe('transferBudget', () => {
  it('POSTs month/to/sources as JSON', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await transferBudget('2026-03', 'Travel', [{ category: 'Dining', amount: 300 }])
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/budgets/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: '2026-03', to: 'Travel', sources: [{ category: 'Dining', amount: 300 }] }),
    })
  })

  it('throws with the status on a failed response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400 })
    await expect(transferBudget('2026-03', 'Travel', [{ category: 'Dining', amount: 300 }])).rejects.toThrow(
      'Failed to transfer budget: 400',
    )
  })
})
