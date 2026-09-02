import { timingSafeEqual, createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { json, nowIST, getCollection } from '@/lib/http'
import { getDb } from '@/lib/mongodb'
import type { Auth } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildNotifications, prefsFor, wrappedNotification } from '@/lib/notifications/rules'
import { claim, claimAndSend } from '@/lib/notifications/deliver'
import { currentEdition, editionStatus } from '@/lib/wrapped'
import type { UserDoc } from '@/lib/users'
import { applyHoldingAction } from '@/lib/holdings'
import { isDueToday, isDueTomorrow, tomorrowOf } from '@/lib/holdingRecurrence'
import { isSubscriptionDueToday } from '@/lib/subscriptions'
import { applySubscriptionExpense } from '@/lib/subscriptionExpense'
import { sendPushNotification } from '@/lib/push'

export const dynamic = 'force-dynamic'

/** Constant-time comparison, normalizing length via SHA-256. */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

async function runForUser(db: Db, user: UserDoc): Promise<number> {
  const prefs = prefsFor(user)
  if (prefs.cadence === 'off') return 0

  const auth: Auth = { userId: user._id, readOnly: false, sessionId: null }
  const { facts, meta, envelopes, subscriptions, categories } = await buildExpenseContext(auth)
  const { date: today } = nowIST()

  const notifications = buildNotifications({
    envelopes,
    subscriptions,
    categories,
    meta,
    prefs,
    today,
    month: today.slice(0, 7),
  })

  let sent = 0
  for (const notification of notifications) {
    if (await claimAndSend(db, user._id, notification, facts)) sent++
  }

  return sent
}

/**
 * Separate pass, not folded into `runForUser`: that function bails out entirely
 * for `cadence === 'off'` users before doing anything, which would silently
 * swallow the one notification meant to re-engage exactly them. It also builds
 * the full AI expense context (envelopes, subscriptions, categories) per user —
 * wrapped only needs a transaction count, so running it inside that path would
 * do the expensive work for the entire user base daily instead of once a month.
 *
 * ponytail: one count per user. Upgrade to a single grouped aggregation over
 * `expenses` if the user base grows large enough for N queries to matter.
 */
async function runWrappedForUser(db: Db, user: UserDoc, month: string): Promise<number> {
  const prefs = prefsFor(user)
  const notification = wrappedNotification(month, prefs)
  if (!notification) return 0

  const auth: Auth = { userId: user._id, readOnly: false, sessionId: null }
  const status = await editionStatus(auth, month)
  if (!status.available) return 0

  return (await claimAndSend(db, user._id, notification, '')) ? 1 : 0
}

function inr(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

/**
 * Auto-applies today's due monthly contributions (SIP/PF) and sends a
 * day-before reminder for tomorrow's — both keyed off the holding's own
 * `recurring_day`/`recurring_last_run`, not `notifyCadence` (a user who
 * turned off the digest may still have a recurring investment running).
 * Runs for every user rather than a cadence-filtered subset for that reason.
 */
async function runRecurringInvestmentsForUser(db: Db, user: UserDoc, today: string): Promise<number> {
  const auth: Auth = { userId: user._id, readOnly: false, sessionId: null }
  const holdingsColl = await getCollection('holdings', auth)
  const recurring = await holdingsColl.find({ is_recurring: 'true' }).toArray()

  let sent = 0
  for (const holding of recurring) {
    const name = String(holding.name)
    const amount = Number(holding.recurring_amount) || 0
    if (amount <= 0) continue
    const recurrence = {
      is_recurring: String(holding.is_recurring),
      recurring_day: String(holding.recurring_day),
      recurring_last_run: String(holding.recurring_last_run),
    }

    if (isDueToday(recurrence, today)) {
      const result = await applyHoldingAction(auth, { name, action: 'contribution', amount })
      if (result.ok) {
        await holdingsColl.updateOne({ name }, { $set: { recurring_last_run: today.slice(0, 7) } })
        if (await claim(db, user._id, `invest:${name}:${today}`)) {
          try {
            await sendPushNotification({
              userId: user._id,
              title: 'SIP added',
              body: `₹${inr(amount)} added to ${name}.`,
              data: { route: '/investments' },
            })
            sent++
          } catch (err) {
            console.error('notifications/run: investment push failed for', user._id, name, err)
          }
        }
      }
    }

    if (isDueTomorrow(recurrence, today)) {
      const tomorrow = tomorrowOf(today)
      if (await claim(db, user._id, `invest-reminder:${name}:${tomorrow}`)) {
        try {
          await sendPushNotification({
            userId: user._id,
            title: 'SIP tomorrow',
            body: `₹${inr(amount)} will be added to ${name} tomorrow.`,
            data: { route: '/investments' },
          })
          sent++
        } catch (err) {
          console.error('notifications/run: investment reminder failed for', user._id, name, err)
        }
      }
    }
  }

  return sent
}

/**
 * Auto-adds an expense for each active, non-one-time subscription due today
 * that has a linked category (a subscription with no category is skipped —
 * nothing to file the expense under). Runs for every user, not a
 * cadence-filtered subset: like recurring investments, this isn't a digest
 * preference — it's the subscription's own due date.
 */
async function runSubscriptionExpensesForUser(db: Db, user: UserDoc, today: string): Promise<number> {
  const auth: Auth = { userId: user._id, readOnly: false, sessionId: null }
  const subsColl = await getCollection('subscriptions', auth)
  const subs = await subsColl.find({}).toArray()

  let sent = 0
  for (const sub of subs) {
    const service = String(sub.service)
    const dueInput = {
      nextDueDate: String(sub.next_due_date ?? ''),
      billingCycle: String(sub.billing_cycle ?? ''),
      renewalOrEndMonth: sub.renewal_or_end_month ? String(sub.renewal_or_end_month) : undefined,
      timestamp: String(sub.timestamp ?? ''),
      status: sub.status ? String(sub.status) : undefined,
    }
    if (!isSubscriptionDueToday(dueInput, today)) continue
    if (!(await claim(db, user._id, `sub-expense:${service}:${today}`))) continue

    const result = await applySubscriptionExpense(auth, {
      service,
      amount_inr: String(sub.amount_inr),
      category: String(sub.category ?? ''),
      notes: sub.notes ? String(sub.notes) : undefined,
    })
    if (!result.ok) continue

    try {
      await sendPushNotification({
        userId: user._id,
        title: `${service} charged`,
        body: `₹${inr(Number(sub.amount_inr) || 0)} auto-added for ${service}.`,
        data: { route: '/activity', category: String(sub.category ?? '') },
      })
      sent++
    } catch (err) {
      console.error('notifications/run: subscription expense push failed for', user._id, service, err)
    }
  }

  return sent
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || !header || !safeEqual(header, `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const users = await db
    .collection<UserDoc>('users')
    .find({ notifyCadence: { $in: ['weekly', 'daily'] }, deleted_at: null })
    .toArray()

  let sent = 0
  for (const user of users) {
    try {
      sent += await runForUser(db, user)
    } catch (err) {
      console.error('notifications/run: failed for', user._id, err)
    }
  }

  const wrappedMonth = currentEdition(nowIST().date)
  const wrappedUsers = await db
    .collection<UserDoc>('users')
    .find({ notifyWrapped: { $ne: false }, deleted_at: null })
    .toArray()

  for (const user of wrappedUsers) {
    try {
      sent += await runWrappedForUser(db, user, wrappedMonth)
    } catch (err) {
      console.error('notifications/run: wrapped failed for', user._id, err)
    }
  }

  // Not filtered by notifyCadence — a recurring investment is its own opt-in,
  // set per-holding, independent of the digest.
  const investmentUsers = await db.collection<UserDoc>('users').find({ deleted_at: null }).toArray()
  const { date: today } = nowIST()
  for (const user of investmentUsers) {
    try {
      sent += await runRecurringInvestmentsForUser(db, user, today)
    } catch (err) {
      console.error('notifications/run: investments failed for', user._id, err)
    }
  }

  // Also unfiltered by notifyCadence, same reasoning as investments above —
  // a subscription's due date isn't a digest preference.
  const subscriptionUsers = await db.collection<UserDoc>('users').find({ deleted_at: null }).toArray()
  for (const user of subscriptionUsers) {
    try {
      sent += await runSubscriptionExpensesForUser(db, user, today)
    } catch (err) {
      console.error('notifications/run: subscription expenses failed for', user._id, err)
    }
  }

  return json({ ok: true, sent })
}
