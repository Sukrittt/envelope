/**
 * Recurring-investment due-date math. Pure, no I/O — same reasoning as
 * `subscriptions.ts`: usable from both the cron route and a future UI/test
 * without dragging in Mongo.
 */

export interface RecurringHolding {
  is_recurring: string
  /** Day of month (1-31) snapshotted once when recurring was turned on. */
  recurring_day: string
  /** 'YYYY-MM' of the last month a contribution was auto-applied. */
  recurring_last_run: string
}

/** Last real day of `dateStr`'s month, so a `recurring_day: 31` holding still fires in a 30/28-day month. */
function lastDayOfMonth(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
}

function dayMatches(dateStr: string, recurringDay: number): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.getUTCDate() === Math.min(recurringDay, lastDayOfMonth(dateStr))
}

/** 'YYYY-MM-DD' one calendar day after `dateStr`. */
export function tomorrowOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Whether `holding`'s monthly contribution should fire today, and hasn't already this month. */
export function isDueToday(holding: RecurringHolding, today: string): boolean {
  if (holding.is_recurring !== 'true') return false
  const day = Number(holding.recurring_day)
  if (!day) return false
  if (holding.recurring_last_run === today.slice(0, 7)) return false
  return dayMatches(today, day)
}

/** Whether `holding`'s monthly contribution is due tomorrow — for the day-before reminder push. */
export function isDueTomorrow(holding: RecurringHolding, today: string): boolean {
  if (holding.is_recurring !== 'true') return false
  const day = Number(holding.recurring_day)
  if (!day) return false
  return dayMatches(tomorrowOf(today), day)
}
