// Twin of Mobile/src/api/bills.ts.
import { apiFetch } from './client'

export interface BillScanItem {
  name: string
  price: number
  qty: number
  divisor: number | null
}

export interface SaveBillScanParams {
  image: string
  mimeType: string
  merchant: string
  category: string
  date: string
  total: number
  my_share: number
  people_count: number
  expense_id: string
  items: BillScanItem[]
}

/**
 * Best-effort persistence of a confirmed bill scan — called right after the
 * expense itself is logged. A failure here shouldn't surface to the user or
 * block navigation; the expense already landed.
 */
export async function saveBillScan(params: SaveBillScanParams): Promise<void> {
  const resp = await apiFetch('/api/bills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(30_000),
  })
  if (!resp.ok) throw new Error(`Failed to save bill scan: ${resp.status}`)
}
