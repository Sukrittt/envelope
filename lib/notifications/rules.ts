import type { Envelope } from '@/src/types/expense'
import type { CategoryDocRow, SubscriptionDocRow, SummarizeExpensesMeta } from '@/lib/ai/expenseContext'
import { getEffectiveDueDate, renewalDays } from '@/lib/subscriptions'
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
  thresholdPct: number
  bills: boolean
  billLeadDays: number
  coach: boolean
}

export type NotificationKind = 'threshold' | 'overspent' | 'bill' | 'digest' | 'coach'

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
    thresholdPct: typeof user.notifyThresholdPct === 'number' ? user.notifyThresholdPct : 80,
    bills: user.notifyBills ?? true,
    billLeadDays: typeof user.notifyBillLeadDays === 'number' ? user.notifyBillLeadDays : 3,
    coach: user.notifyCoach ?? true,
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

function thresholdNotifications(envelopes: Envelope[], categories: CategoryDocRow[], prefs: NotificationPrefs, month: string): Notification[] {
  const alertPctByCategory = new Map(
    categories.filter((c) => typeof c.alertPct === 'number').map((c) => [c.name, c.alertPct as number]),
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

    const pct = alertPctByCategory.get(env.category) ?? prefs.thresholdPct
    if (pct > 0 && env.assigned > 0 && env.spentPct >= pct) {
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
  if (prefs.cadence === 'off') return []

  const notifications: Notification[] = [
    ...thresholdNotifications(envelopes, categories, prefs, month),
    ...billNotifications(subscriptions, prefs),
  ]

  const digest = digestNotification(meta, prefs, today)
  if (digest) notifications.push(digest)

  const coach = coachNotification(envelopes, meta, prefs, today)
  if (coach) notifications.push(coach)

  return notifications
}
