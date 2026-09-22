import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { apiFetch } from './client'
import { updateHolding } from './holdings'
import { HoldingWriteError } from '@/src/lib/holdingConflict'

vi.mock('./client', () => ({ apiFetch: vi.fn() }))

const mockedApiFetch = apiFetch as Mock

beforeEach(() => mockedApiFetch.mockReset())

describe('updateHolding', () => {
  it('sends the loaded revision with the edit', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ version: 5 }) })

    await updateHolding('Stocks', { is_recurring: true, recurring_amount: '250' }, 4)

    expect(mockedApiFetch).toHaveBeenCalledWith('/api/holdings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stocks', version: 4, is_recurring: true, recurring_amount: '250' }),
    })
  })

  it('surfaces the latest holding on a conflict', async () => {
    const current = {
      name: 'Stocks', type: 'Equity', value: '1250', updated_at: '2026-09-22',
      is_recurring: 'true', recurring_amount: '100', recurring_day: '1', recurring_last_run: '2026-09', version: 5,
    }
    mockedApiFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'changed', current }) })

    const write = updateHolding('Stocks', { recurring_amount: '250' }, 4)

    await expect(write).rejects.toBeInstanceOf(HoldingWriteError)
    await expect(write).rejects.toMatchObject({ status: 409, current })
  })
})
