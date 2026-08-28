import { timingSafeEqual, createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { json, nowIST } from '@/lib/http'
import { getDb } from '@/lib/mongodb'
import type { Auth } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildNotifications, prefsFor, wrappedNotification } from '@/lib/notifications/rules'
import { claimAndSend } from '@/lib/notifications/deliver'
import { currentEdition, editionStatus } from '@/lib/wrapped'
import type { UserDoc } from '@/lib/users'

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

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || !header || !safeEqual(header, `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const users = await db
    .collection<UserDoc>('users')
    .find({ notifyCadence: { $in: ['weekly', 'daily'] } })
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
    .find({ notifyWrapped: { $ne: false } })
    .toArray()

  for (const user of wrappedUsers) {
    try {
      sent += await runWrappedForUser(db, user, wrappedMonth)
    } catch (err) {
      console.error('notifications/run: wrapped failed for', user._id, err)
    }
  }

  return json({ ok: true, sent })
}
