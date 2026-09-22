import { apiFetch, apiErrorMessage } from './client'
import type { RecurringScan, ScanMonths } from '../types/recurringSuggestions'
const URL = '/api/recurring-expenses/suggestions'
export async function loadRecurringSuggestions(months: ScanMonths = 6): Promise<RecurringScan> {
  const resp = await apiFetch(`${URL}?months=${months}`)
  if (!resp.ok) throw new Error(await apiErrorMessage(resp, 'Could not load suggestions'))
  return resp.json()
}
export async function scanRecurringSuggestions(months: ScanMonths = 6): Promise<RecurringScan> {
  const resp = await apiFetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ months }), signal: AbortSignal.timeout(65_000) })
  if (!resp.ok) throw new Error(await apiErrorMessage(resp, 'Could not scan expenses'))
  return resp.json()
}
export async function dismissRecurringSuggestion(id: string): Promise<void> {
  const resp = await apiFetch(URL, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  if (!resp.ok) throw new Error(await apiErrorMessage(resp, 'Could not dismiss suggestion'))
}
