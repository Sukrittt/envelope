import { getDb } from './mongodb'
import { COLLECTIONS } from './models'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type PushToken = {
  token: string
  platform: 'ios' | 'android'
  user_id: string
  createdAt: string
  updatedAt: string
}

/**
 * Upsert a device's push token. `createdAt` is set once, `updatedAt` on every
 * call, and `user_id` on every call too — a device that re-registers under a
 * different account moves to that account rather than notifying both.
 */
export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
  userId: string,
): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.collection<PushToken>(COLLECTIONS.pushTokens).updateOne(
    { token },
    {
      $set: { token, platform, user_id: userId, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )
}

type ExpoPushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound: 'default'
}

type ExpoPushTicket = {
  status: 'ok' | 'error'
  details?: { error?: string }
}

/**
 * Push a notification to one user's registered devices via Expo's push API.
 * Sends that user's tokens in one batched request; tokens Expo reports as
 * DeviceNotRegistered are pruned from `push_tokens`. Individual per-device
 * send failures are logged, not thrown — only a failure of the HTTP call
 * itself propagates.
 *
 * `userId` is required rather than optional on purpose: this used to send to
 * every registered device on the platform, and an accidental omission would
 * silently restore that.
 */
export async function sendPushNotification({
  userId,
  title,
  body,
  data,
}: {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  const db = await getDb()
  const coll = db.collection<PushToken>(COLLECTIONS.pushTokens)
  const tokens = await coll.find({ user_id: userId }).toArray()
  if (tokens.length === 0) return

  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default',
  }))

  const resp = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })

  if (!resp.ok) {
    throw new Error(`Expo push send failed: ${resp.status}`)
  }

  const result = (await resp.json()) as { data?: ExpoPushTicket[] }
  const tickets = result.data ?? []

  const staleTokens: string[] = []
  tickets.forEach((ticket, i) => {
    if (ticket.status === 'error') {
      console.error('Expo push error for token', tokens[i]?.token, ticket.details?.error)
      if (ticket.details?.error === 'DeviceNotRegistered') {
        staleTokens.push(tokens[i].token)
      }
    }
  })

  if (staleTokens.length > 0) {
    await coll.deleteMany({ token: { $in: staleTokens } })
  }
}
