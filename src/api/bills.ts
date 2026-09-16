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

/** One row on the scan history list — no `items`/image, those only load on the detail view. */
export interface BillScanSummary {
  id: string
  merchant: string
  category: string
  date: string
  total: number
  my_share: number
  people_count: number
  item_count: number
  image_status: 'pending' | 'ready' | 'failed'
  created_at: string
}

export interface BillScanDetail {
  id: string
  merchant: string
  category: string
  date: string
  total: number
  my_share: number
  people_count: number
  items: BillScanItem[]
  expense_id: string
  image_status: 'pending' | 'ready' | 'failed'
  /** A short-lived signed URL, or null until the upload finishes (or if it failed). */
  image_url: string | null
  created_at: string
}

export async function getBillScans(): Promise<BillScanSummary[]> {
  const resp = await apiFetch('/api/bills')
  if (!resp.ok) throw new Error(`Failed to load bill scans: ${resp.status}`)
  const data: { bills: BillScanSummary[] } = await resp.json()
  return data.bills
}

export async function getBillScan(id: string): Promise<BillScanDetail> {
  const resp = await apiFetch(`/api/bills/${encodeURIComponent(id)}`)
  if (!resp.ok) throw new Error(`Failed to load bill scan: ${resp.status}`)
  return resp.json()
}
