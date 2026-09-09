import { apiFetch } from './client'
import type { CsvResponse, SubscriptionRow } from '@/src/types'

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const resp = await apiFetch('/api/subscriptions')
  if (!resp.ok) throw new Error(`Failed to load subscriptions: ${resp.status}`)
  const data: CsvResponse<SubscriptionRow> = await resp.json()
  return data.rows
}

export async function updateSubscription(
  service: string,
  updates: {
    new_service?: string
    amount_inr?: string
    billing_cycle?: string
    next_due_date?: string
    notes?: string
    status?: string
    category?: string
  },
): Promise<void> {
  const resp = await apiFetch('/api/subscriptions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, ...updates }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to update subscription: ${resp.status}`)
  }
}

export async function cancelSubscription(service: string): Promise<void> {
  await updateSubscription(service, { status: 'cancelled' })
}

export async function reactivateSubscription(service: string): Promise<void> {
  await updateSubscription(service, { status: 'active' })
}

export async function addSubscription(row: {
  service: string
  amount_inr: string
  billing_cycle?: string
  next_due_date?: string
  notes?: string
  category?: string
}): Promise<void> {
  const resp = await apiFetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(row),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to add subscription: ${resp.status}`)
  }
}

export async function deleteSubscription(service: string): Promise<void> {
  const resp = await apiFetch('/api/subscriptions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service }),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}))
    throw new Error(detail.error ?? `Failed to delete subscription: ${resp.status}`)
  }
}
