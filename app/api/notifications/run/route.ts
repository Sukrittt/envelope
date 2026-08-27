import { timingSafeEqual, createHash } from 'node:crypto'
import type { Db } from 'mongodb'
import { Type } from '@google/genai'
import { json, nowIST } from '@/lib/http'
import { getDb } from '@/lib/mongodb'
import type { Auth } from '@/lib/access'
import { buildExpenseContext } from '@/lib/ai/expenseContext'
import { buildNotifications, type Notification, type NotificationPrefs } from '@/lib/notifications/rules'
import { generateJSON } from '@/lib/ai/gemini'
import { sendPushNotification } from '@/lib/push'
import { COLLECTIONS } from '@/lib/models'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

/** Constant-time comparison, normalizing length via SHA-256. */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000
}

function prefsFor(user: UserDoc): NotificationPrefs {
  return {
    cadence: user.notifyCadence === 'weekly' || user.notifyCadence === 'daily' ? user.notifyCadence : 'off',
    thresholdPct: typeof user.notifyThresholdPct === 'number' ? user.notifyThresholdPct : 80,
    bills: user.notifyBills ?? true,
    billLeadDays: typeof user.notifyBillLeadDays === 'number' ? user.notifyBillLeadDays : 3,
    coach: user.notifyCoach ?? true,
  }
}

/**
 * Upgrade a 'coach' notification's body with a Gemini-written suggestion,
 * grounded in the same FACTS text used for the money-brain chat/brief. Falls
 * back to the plain arithmetic body from `rules.ts` on any failure — the
 * notification still sends either way.
 */
async function enrichCoachNotification(notification: Notification, facts: string): Promise<Notification> {
  try {
    const prompt = [
      'You are writing a single push-notification nudge for a personal expense tracker, grounded strictly in the FACTS below.',
      'The user is at risk of overspending this month. Write one concrete, specific suggestion — e.g. moving slack from an',
      'under-spent envelope to cover the shortfall guilt-free, or naming the category to cut back on.',
      'Keep the body to one sentence, at most 140 characters. Never invent a number not present in FACTS.',
      '',
      'FACTS:',
      facts,
    ].join('\n')

    const result = await generateJSON<{ title: string; body: string }>(prompt, {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        body: { type: Type.STRING },
      },
      required: ['title', 'body'],
    })
    return { ...notification, title: result.title, body: result.body }
  } catch (err) {
    console.error('notifications/run: coach enrichment failed, using fallback body', err)
    return notification
  }
}

/** Claims `key` in the send log; returns true if this call won the claim (i.e. it hasn't been sent yet). */
async function claim(db: Db, userId: string, key: string): Promise<boolean> {
  try {
    await db.collection(COLLECTIONS.notificationLog).insertOne({ user_id: userId, key, sentAt: new Date() })
    return true
  } catch (err) {
    if (isDuplicateKeyError(err)) return false
    throw err
  }
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
    if (!(await claim(db, user._id, notification.key))) continue

    const toSend = notification.kind === 'coach' ? await enrichCoachNotification(notification, facts) : notification

    try {
      await sendPushNotification({
        userId: user._id,
        title: toSend.title,
        body: toSend.body,
        data: toSend.data,
      })
      sent++
    } catch (err) {
      console.error('notifications/run: send failed for', user._id, notification.key, err)
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

  return json({ ok: true, sent })
}
