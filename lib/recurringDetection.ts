import { createHash } from 'node:crypto'
import { advance, type Frequency } from './recurringExpense'

// Bump whenever normalization or questions change; old decisions must not survive it.
export const DETECTION_VERSION = 'recurring-v4'
export type DetectionDecision = { pattern: 'subscription' | 'other_recurring'; frequency: Frequency } | null
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function normalizeItem(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
type Payment = { id: string; version: number; date: string; item: string; amount: number; category: string; paymentMethod: string; notes: string }
export type RecurringCandidate = { fingerprint: string; payments: Payment[]; currency: string }
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function buildCandidates(rows: Record<string, unknown>[], tracked: string[], currency: string): RecurringCandidate[] {
  const excluded = new Set(tracked.map(normalizeItem))
  const groups = new Map<string, Payment[]>()
  for (const row of rows) {
    const item = String(row.item ?? row.description ?? '').trim()
    const name = normalizeItem(item)
    const amount = Number(row.amount_inr ?? row.amount)
    const date = String(row.date ?? '')
    const source = String(row.source ?? '').toLowerCase()
    if (!name || excluded.has(name) || !validDate(date) || !Number.isFinite(amount) || amount <= 0 ||
        ['recurring', 'subscription', 'transfer', 'refund'].includes(source)) continue
    const paymentMethod = row.payment_method === 'credit_card' ? 'credit_card' : 'bank'
    const key = `${name}:${paymentMethod}`
    const group = groups.get(key) ?? []
    group.push({ id: String(row._id), version: Number(row.version ?? 0), date, item: item.slice(0, 200), amount, category: String(row.category ?? ''), paymentMethod, notes: String(row.notes ?? '').slice(0, 300) })
    groups.set(key, group)
  }
  return [...groups.values()].filter(group => new Set(group.map(r => r.date)).size >= 2).map(payments => {
    payments.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    return { fingerprint: fingerprint([DETECTION_VERSION, currency, payments]), payments, currency }
  }).sort((a, b) => b.payments.at(-1)!.date.localeCompare(a.payments.at(-1)!.date) || a.fingerprint.localeCompare(b.fingerprint))
}
export function nextSuggestedDate(lastDate: string, frequency: Frequency, today: string): string {
  let next = lastDate
  const anchor = Number(lastDate.slice(8, 10))
  // The scan only considers six months of history.
  for (let i = 0; i < 400 && next <= today; i++) next = advance(next, frequency, anchor)
  return next
}
export function scanWindow(today: string, months: 1 | 3 | 6 = 6): string {
  const date = new Date(`${today}T00:00:00Z`)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1))
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  start.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return start.toISOString().slice(0, 10)
}
