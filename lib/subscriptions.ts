/**
 * Subscription due-date math. Pure, no I/O — usable from both a React view
 * (`src/views/ExpensePage.tsx`) and a server route/cron, which is the point:
 * this logic used to live only inside a JSX closure and was unreachable from
 * a route handler.
 */

export interface DueDateInput {
  nextDueDate: string
  billingCycle: string
  renewalOrEndMonth?: string
  timestamp: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** Advances `dateStr` by one billing cycle, inferred from `cycle`'s free-form text. */
export function rollForward(dateStr: string, cycle: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  if (/yearly|annual/i.test(cycle)) d.setFullYear(d.getFullYear() + 1)
  else if (/quarterly/i.test(cycle)) d.setMonth(d.getMonth() + 3)
  else if (/weekly/i.test(cycle)) d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Resolves the next date a subscription is due, in three tiers: a stored
 * `nextDueDate` rolled forward past today, then `renewalOrEndMonth`, then a
 * monthly cycle derived from the first-charge `timestamp`. Returns `''` if
 * none apply.
 */
export function getEffectiveDueDate(sub: DueDateInput): string {
  if (sub.nextDueDate) {
    let d = new Date(sub.nextDueDate)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    while (d <= now) {
      const rolled = rollForward(d.toISOString().slice(0, 10), sub.billingCycle)
      if (!rolled) break
      d = new Date(rolled)
    }
    return d.toISOString().slice(0, 10)
  }
  if (sub.renewalOrEndMonth) {
    const parts = sub.renewalOrEndMonth.split(' ')
    if (parts.length >= 2) {
      const m = MONTH_NAMES.indexOf(parts[0])
      const y = parseInt(parts[1])
      if (m >= 0 && !Number.isNaN(y)) return new Date(y, m, 1).toISOString().slice(0, 10)
    }
  }
  if (sub.timestamp && /monthly/i.test(sub.billingCycle)) {
    const start = new Date(sub.timestamp)
    if (!Number.isNaN(start.getTime())) {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth() + 1, start.getDate())
      if (next <= now) next.setMonth(next.getMonth() + 1)
      return next.toISOString().slice(0, 10)
    }
  }
  return ''
}

/** Human-readable "renews in Nd" label, or '' if the date is missing or already past. */
export function daysUntil(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Math.round((new Date(dateStr).getTime() - new Date().getTime()) / 86400000)
  if (diff < 0) return ''
  if (diff === 0) return 'renews today'
  if (diff === 1) return 'renews tomorrow'
  return `renews in ${diff}d`
}

/** Days until the subscription's effective due date; `Infinity` for one-time or undated subscriptions. */
export function renewalDays(sub: DueDateInput & { billingCycle: string }): number {
  if (/one-time/i.test(sub.billingCycle)) return Infinity
  const due = getEffectiveDueDate(sub)
  if (!due) return Infinity
  return Math.round((new Date(due).getTime() - new Date().getTime()) / 86400000)
}
