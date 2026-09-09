import { apiFetch } from './client'
import type { CsvResponse, HoldingEventRow } from '@/src/types'

export async function getHoldingEvents(): Promise<HoldingEventRow[]> {
  const resp = await apiFetch('/api/holding-events')
  if (!resp.ok) throw new Error(`Failed to load holding events: ${resp.status}`)
  const data: CsvResponse<HoldingEventRow> = await resp.json()
  return data.rows
}
