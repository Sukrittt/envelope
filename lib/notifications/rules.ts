import type { Envelope } from '@/src/types/expense'
import type { CategoryDocRow, SubscriptionDocRow, SummarizeExpensesMeta } from '@/lib/ai/expenseContext'
import { getEffectiveDueDate, renewalDays, MONTH_NAMES } from '@/lib/subscriptions'
import type { UserDoc } from '@/lib/users'

/**
 * Pure decision logic for Smart Notifications: given a user's current
 * envelopes/subscriptions/prefs, decide which notifications should fire
 * *right now*. No I/O, no Mongo, no Gemini — the caller (the cron route)
 * fetches the data, claims each returned `key` in the send log (skipping any
 * that are already claimed), and does the actual push.
 */

export interface NotificationPrefs {
  cadence: 'off' | 'weekly' | 'daily'
  /** Category limit alerts (threshold + overspent) — independent of `cadence`, which only gates the digest. */
  thresholds: boolean
  bills: boolean
  billLeadDays: number
  coach: boolean
  /** New monthly Wrapped edition unlocked — independent of `cadence`. */
  wrapped: boolean
}

/** Trigger percentages applied to any category that hasn't customized its own. */
export const DEFAULT_ALERT_PCTS = [50, 90, 100]

export type NotificationKind = 'threshold' | 'overspent' | 'bill' | 'digest' | 'coach' | 'wrapped'

export interface Notification {
  /** Dedupe key claimed in `notification_log`; stable across runs until the underlying fact changes. */
  key: string
  kind: NotificationKind
  title: string
  body: string
  data?: Record<string, unknown>
}

/** Resolves a user's notification prefs, defaulting fields never set on the doc. */
export function prefsFor(user: UserDoc): NotificationPrefs {
  return {
    cadence: user.notifyCadence === 'weekly' || user.notifyCadence === 'daily' ? user.notifyCadence : 'off',
    thresholds: user.notifyThresholds ?? true,
    bills: user.notifyBills ?? true,
    billLeadDays: typeof user.notifyBillLeadDays === 'number' ? user.notifyBillLeadDays : 3,
    coach: user.notifyCoach ?? true,
    wrapped: user.notifyWrapped ?? true,
  }
}

const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'ended', 'paused'])

function inr(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

/** ISO 8601 week key ('YYYY-Www') for a 'YYYY-MM-DD' date, so a weekly notification fires once per week. */
function isoWeekKey(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function thresholdNotifications(envelopes: Envelope[], categories: CategoryDocRow[], month: string): Notification[] {
  const alertPctsByCategory = new Map(
    categories.filter((c) => Array.isArray(c.alertPcts)).map((c) => [c.name, c.alertPcts as number[]]),
  )
  const out: Notification[] = []

  for (const env of envelopes) {
    if (env.isCreditCardPayment) continue

    if (env.isOverspent) {
      out.push({
        key: `over:${month}:${env.category}`,
        kind: 'overspent',
        title: `${env.category} is over budget`,
        body: `You've overspent ₹${inr(-env.available)} in ${env.category} this month.`,
        data: { category: env.category },
      })
      continue
    }

    if (env.assigned <= 0) continue
    const pcts = alertPctsByCategory.get(env.category) ?? DEFAULT_ALERT_PCTS
    // Only the highest crossed threshold fires. The title reports *current* spend,
    // not the threshold, so a jump from 10% to 98% crossing 25/50/90 at once would
    // otherwise send three pushes reading identically ("Utilities is at 98%").
    // Lower thresholds keep their own keys, so a smaller move that only clears one
    // of them still fires that one.
    const crossed = pcts.filter((pct) => pct > 0 && env.spentPct >= pct)
    if (crossed.length > 0) {
      const pct = Math.max(...crossed)
      out.push({
        key: `thr:${month}:${env.category}:${pct}`,
        kind: 'threshold',
        title: `${env.category} is at ${Math.round(env.spentPct)}%`,
        body: `₹${inr(env.spent)} of ₹${inr(env.assigned)} spent in ${env.category}.`,
        data: { category: env.category },
      })
    }
  }

  return out
}

function billNotifications(subscriptions: SubscriptionDocRow[], prefs: NotificationPrefs): Notification[] {
  if (!prefs.bills) return []
  const out: Notification[] = []

  for (const sub of subscriptions) {
    if (sub.status && INACTIVE_STATUSES.has(sub.status.toLowerCase())) continue
    if (/one-time/i.test(sub.billing_cycle ?? '')) continue

    const dueInput = {
      nextDueDate: sub.next_due_date ?? '',
      billingCycle: sub.billing_cycle ?? '',
      renewalOrEndMonth: sub.renewal_or_end_month,
      timestamp: sub.timestamp ?? '',
    }
    if (renewalDays(dueInput) !== prefs.billLeadDays) continue

    const due = getEffectiveDueDate(dueInput)
    if (!due) continue

    const days = prefs.billLeadDays
    out.push({
      key: `bill:${sub.service}:${due}`,
      kind: 'bill',
      title: `${sub.service} renews soon`,
      body: `₹${inr(sub.amount_inr)} due in ${days} day${days === 1 ? '' : 's'} (${due}).`,
    })
  }

  return out
}

function digestNotification(meta: SummarizeExpensesMeta, prefs: NotificationPrefs, today: string): Notification | null {
  if (prefs.cadence !== 'daily' && prefs.cadence !== 'weekly') return null

  const available = Math.round(meta.totalAssigned - meta.totalSpent)
  const body = `₹${inr(meta.totalSpent)} spent this month · ₹${inr(available)} left · ${meta.daysLeft} day${meta.daysLeft === 1 ? '' : 's'} to go.`
  const key = prefs.cadence === 'daily' ? `digest:${today}` : `digest:w:${isoWeekKey(today)}`

  return { key, kind: 'digest', title: 'Your spending update', body }
}

function coachNotification(
  envelopes: Envelope[],
  meta: SummarizeExpensesMeta,
  prefs: NotificationPrefs,
  today: string,
): Notification | null {
  if (!prefs.coach) return null

  const projected = meta.daysElapsed > 0 ? (meta.totalSpent / meta.daysElapsed) * meta.totalDaysInMonth : 0
  const projectedOverspend = meta.totalAssigned > 0 && projected > meta.totalAssigned
  const overspentEnvelope = envelopes.find((e) => !e.isCreditCardPayment && e.isOverspent)

  if (!projectedOverspend && !overspentEnvelope) return null

  const body = projectedOverspend
    ? `Projected to spend ₹${inr(projected)} this month vs ₹${inr(meta.totalAssigned)} budgeted — consider trimming a category.`
    : `${overspentEnvelope!.category} is over budget; move some slack from an under-spent envelope to cover it guilt-free.`

  return {
    key: `coach:${isoWeekKey(today)}`,
    kind: 'coach',
    title: 'Heads up on this month',
    body,
  }
}

/**
 * The monthly Wrapped-unlock nudge. Run as its own pass by the cron route
 * (`app/api/notifications/run`), not folded into `buildNotifications` — that
 * function's caller only fetches expense-context data for users with
 * `cadence !== 'off'`, which would silently exclude exactly the users this
 * notification exists to re-engage.
 */
export function wrappedNotification(month: string, prefs: NotificationPrefs): Notification | null {
  if (!prefs.wrapped) return null
  const [, m] = month.split('-')
  const label = MONTH_NAMES[Number(m) - 1]
  return {
    key: `wrapped:${month}`,
    kind: 'wrapped',
    title: 'Your Wrapped is ready',
    body: `Your ${label} Expense Wrapped just unlocked.`,
    data: { route: '/wrapped' },
  }
}

export function buildNotifications(input: {
  envelopes: Envelope[]
  subscriptions: SubscriptionDocRow[]
  categories: CategoryDocRow[]
  meta: SummarizeExpensesMeta
  prefs: NotificationPrefs
  today: string // 'YYYY-MM-DD'
  month: string // 'YYYY-MM'
}): Notification[] {
  const { envelopes, subscriptions, categories, meta, prefs, today, month } = input

  const notifications: Notification[] = []
  if (prefs.thresholds) notifications.push(...thresholdNotifications(envelopes, categories, month))

  // Cadence is the digest's own on/off switch — it no longer gates category
  // limit alerts (those have `prefs.thresholds`), but still gates bills and
  // the coaching nudge alongside the digest itself.
  if (prefs.cadence !== 'off') {
    notifications.push(...billNotifications(subscriptions, prefs))

    const digest = digestNotification(meta, prefs, today)
    if (digest) notifications.push(digest)

    const coach = coachNotification(envelopes, meta, prefs, today)
    if (coach) notifications.push(coach)
  }

  return notifications
}
