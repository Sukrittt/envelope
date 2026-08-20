import { getDb } from './mongodb'
import { getWorkOSClient } from './workosClient'

export interface UserDoc {
  _id: string
  email: string
  firstName: string | null
  lastName: string | null
  createdAt: Date
  onboardedAt?: string | null
  notifyCadence?: 'off' | 'weekly' | 'daily'
}

interface WorkOSUserLike {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
}

/** Upsert from a WorkOS user object already in hand — e.g. a fresh authenticate response. */
export async function ensureUser(user: WorkOSUserLike): Promise<void> {
  const db = await getDb()
  await db.collection<UserDoc>('users').updateOne(
    { _id: user.id },
    {
      $setOnInsert: {
        _id: user.id,
        email: user.email,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  )
}

/** Upsert by id alone — fetches the WorkOS user only when the local row doesn't exist yet. */
export async function ensureUserById(userId: string): Promise<void> {
  const db = await getDb()
  const existing = await db.collection<UserDoc>('users').findOne({ _id: userId }, { projection: { _id: 1 } })
  if (existing) return

  const user = await getWorkOSClient().userManagement.getUser(userId)
  await ensureUser(user)
}
