import { getDb } from './mongodb'
import { COLLECTIONS } from './models'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type PushToken = {
  token: string
  platform: 'ios' | 'android'
  createdAt: string
  updatedAt: string
}

/** Upsert a device's push token. `createdAt` is set once, `updatedAt` on every call. */
export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.collection<PushToken>(COLLECTIONS.pushTokens).updateOne(
    { token },
    {
      $set: { token, platform, updatedAt: now },
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
 * Push a notification to every registered device via Expo's push API.
 * Sends all tokens in one batched request; tokens Expo reports as
 * DeviceNotRegistered are pruned from `push_tokens`. Individual per-device
 * send failures are logged, not thrown — only a failure of the HTTP call
 * itself propagates.
 */
export async function sendPushNotification({
  title,
  body,
  data,
}: {
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  const db = await getDb()
  const coll = db.collection<PushToken>(COLLECTIONS.pushTokens)
  const tokens = await coll.find({}).toArray()
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
