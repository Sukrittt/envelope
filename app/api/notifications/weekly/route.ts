import { timingSafeEqual, createHash } from 'node:crypto'
import { json } from '@/lib/http'
import { getDb } from '@/lib/mongodb'
import { scoped } from '@/lib/scoped'
import { sendPushNotification } from '@/lib/push'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

/** Constant-time comparison, normalizing length via SHA-256. */
function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest()
  const bh = createHash('sha256').update(b).digest()
  return timingSafeEqual(ah, bh)
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get('authorization')
  if (!secret || !header || !safeEqual(header, `Bearer ${secret}`)) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const users = await db.collection<UserDoc>('users').find({ notifyCadence: 'weekly' }).toArray()

  const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  let sent = 0

  for (const user of users) {
    try {
      const expenses = await scoped(db.collection('expenses'), user._id)
        .find({ date: { $gte: sinceDate } })
        .toArray()
      const total = expenses.reduce((sum, e) => sum + (Number(e.amount_inr) || 0), 0)

      await sendPushNotification({
        userId: user._id,
        title: 'Your week in spending',
        body: `₹${total.toLocaleString('en-IN')} spent this week`,
      })
      sent++
    } catch (err) {
      console.error('notifications/weekly: send failed for', user._id, err)
    }
  }

  return json({ ok: true, sent })
}
