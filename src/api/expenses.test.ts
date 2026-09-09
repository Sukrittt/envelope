import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { apiFetch } from './client'
import { getExpenses, addExpense, updateExpense, deleteExpense } from './expenses'

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

const mockedApiFetch = apiFetch as Mock

beforeEach(() => {
  mockedApiFetch.mockReset()
})

describe('getExpenses', () => {
  it('unwraps rows from the CSV response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({ headers: [], rows: [{ item: 'Coffee' }] }) })
    const rows = await getExpenses()
    expect(rows).toEqual([{ item: 'Coffee' }])
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/expenses')
  })

  it('throws with the status on a failed response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(getExpenses()).rejects.toThrow('Failed to load expenses: 500')
  })
})

describe('addExpense', () => {
  it('POSTs the row with a minted client_id, date and timestamp', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await addExpense({ item: 'Coffee', amount_inr: '150', category: 'Food' })

    expect(mockedApiFetch).toHaveBeenCalledTimes(1)
    const [path, init] = mockedApiFetch.mock.calls[0]
    expect(path).toBe('/api/expenses')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ item: 'Coffee', amount_inr: '150', category: 'Food' })
    expect(typeof body.client_id).toBe('string')
    expect(body.client_id.length).toBeGreaterThan(0)
    expect(body.date).toEqual(expect.any(String))
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/)
  })

  it('throws an HttpError carrying the status on a failed response', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(addExpense({ item: 'Coffee', amount_inr: '150', category: 'Food' })).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe('updateExpense', () => {
  it('reads {error} from the response body on failure', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Amount required' }) })
    await expect(updateExpense('id1', 'ts', 'Coffee', 150, {})).rejects.toThrow('Amount required')
  })

  it('falls back to a generic message when the body has no error field', async () => {
    mockedApiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    await expect(updateExpense('id1', 'ts', 'Coffee', 150, {})).rejects.toThrow('Failed to update expense: 400')
  })
})

describe('deleteExpense', () => {
  it('DELETEs with the identifying fields', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true })
    await deleteExpense('id1', 'ts', 'Coffee', 150)
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'id1', timestamp: 'ts', item: 'Coffee', amount_inr: '150' }),
    })
  })
})
