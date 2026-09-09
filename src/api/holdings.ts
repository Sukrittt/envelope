import { apiFetch } from './client'
import type { CsvResponse, HoldingRow } from '@/src/types'

export async function getHoldings(): Promise<HoldingRow[]> {
  const resp = await apiFetch('/api/holdings')
  if (!resp.ok) throw new Error(`Failed to load holdings: ${resp.status}`)
  const data: CsvResponse<HoldingRow> = await resp.json()
  return data.rows
}

export async function addHolding(row: {
  name: string
  type: string
  value: string
  is_recurring?: boolean
  recurring_amount?: string
}): Promise<void> {
  const resp = await apiFetch('/api/holdings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to add holding: ${resp.status}`)
  }
}

export async function updateHolding(
  name: string,
  updates: {
    new_name?: string
    type?: string
    value?: string
    updated_at?: string
    is_recurring?: boolean
    recurring_amount?: string
  },
): Promise<void> {
  const resp = await apiFetch('/api/holdings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update holding: ${resp.status}`)
  }
}

export async function deleteHolding(name: string): Promise<void> {
  const resp = await apiFetch('/api/holdings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to delete holding: ${resp.status}`)
  }
}

export async function performHoldingAction(params: {
  name: string
  action: 'market_update' | 'contribution' | 'withdrawal'
  amount: number
}): Promise<{ previousValue: number; newValue: number }> {
  const resp = await apiFetch('/api/holdings/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed: ${resp.status}`)
  }
  return resp.json()
}
