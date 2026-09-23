import { createHash } from 'node:crypto'
import { advance, type Frequency } from './recurringExpense'

// Bump whenever normalization or questions change; old decisions must not survive it.
export const DETECTION_VERSION = 'recurring-v6'
export type DetectionFrequency = Frequency | 'quarterly'
export type DetectionDecision = { pattern: 'subscription' | 'other_recurring'; frequency: DetectionFrequency } | null
export type CadenceAnalysis = {
  sortedDates: string[]
  intervals: { days: number; calendarMonths: number; billingDayDrift: number }[]
  deterministicCadence: DetectionFrequency | 'uncertain'
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
export function normalizeItem(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
type Payment = { id: string; version: number; date: string; item: string; amount: number; category: string; paymentMethod: string; notes: string }
export type RecurringCandidate = { fingerprint: string; payments: Payment[]; currency: string; timing: CadenceAnalysis }
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
function cadenceForInterval(interval: CadenceAnalysis['intervals'][number]): DetectionFrequency | 'uncertain' {
  if (interval.days === 1) return 'daily'
  if (Math.abs(interval.days - 7) <= 2) return 'weekly'
  if (interval.calendarMonths === 1 && interval.billingDayDrift <= 5) return 'monthly'
  if (interval.calendarMonths === 3 && interval.billingDayDrift <= 7) return 'quarterly'
  if (interval.calendarMonths === 12 && interval.billingDayDrift <= 14) return 'yearly'
  return 'uncertain'
}
export function analyzeCadence(dates: string[]): CadenceAnalysis {
  const sortedDates = [...new Set(dates.filter(validDate))].sort()
  const intervals = sortedDates.slice(1).map((date, index) => {
    const previous = sortedDates[index]
    const from = new Date(`${previous}T00:00:00Z`)
    const to = new Date(`${date}T00:00:00Z`)
    return {
      days: Math.round((to.getTime() - from.getTime()) / 86_400_000),
      calendarMonths: (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth(),
      billingDayDrift: Math.abs(to.getUTCDate() - from.getUTCDate()),
    }
  })
  const cadences = intervals.map(cadenceForInterval)
  const deterministicCadence = cadences.length > 0 && cadences.every(cadence => cadence === cadences[0])
    ? cadences[0]
    : 'uncertain'
  return { sortedDates, intervals, deterministicCadence }
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
  return [...groups.values()]
    .filter(group => new Set(group.map(r => r.date)).size >= 2)
    .map(payments => {
      payments.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      const timing = analyzeCadence(payments.map(payment => payment.date))
      return { fingerprint: fingerprint([DETECTION_VERSION, currency, payments]), payments, currency, timing }
    })
    .filter(candidate => candidate.timing.deterministicCadence !== 'uncertain')
    .sort((a, b) => b.payments.at(-1)!.date.localeCompare(a.payments.at(-1)!.date) || a.fingerprint.localeCompare(b.fingerprint))
}
export function nextSuggestedDate(lastDate: string, frequency: DetectionFrequency, today: string): string {
  let next = lastDate
  const anchor = Number(lastDate.slice(8, 10))
  // Advance until the proposed date is strictly in the future.
  for (let i = 0; i < 400 && next <= today; i++) next = advance(next, frequency, anchor)
  return next
}
export function scanWindow(today: string, months: 1 | 3 | 6 | 12 = 6): string {
  const date = new Date(`${today}T00:00:00Z`)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1))
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
  start.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return start.toISOString().slice(0, 10)
}
