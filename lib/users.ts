import { getDb } from './mongodb'
import { getWorkOSClient } from './workosClient'

export interface UserDoc {
  _id: string
  email: string
  /**
   * Mirrors the WorkOS user's `emailVerified`. Missing on docs from before this
   * field existed — safe to default to `true`: AuthKit requires a verified
   * email to complete sign-in (`isEmailVerificationRequired`), so any user who
   * already has a session got here with a verified address.
   */
  emailVerified?: boolean
  name: string | null
  avatarUrl: string | null
  createdAt: Date
  onboardedAt?: string | null
  notifyCadence?: 'off' | 'weekly' | 'daily'
  /** Legacy fields from before the flat `name` field — read via `displayName`, never written. */
  firstName?: string | null
  lastName?: string | null
}

interface WorkOSUserLike {
  id: string
  email: string
  emailVerified?: boolean
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  profilePictureUrl?: string | null
}

/** The user's display name, falling back to the pre-migration first/last name fields. */
export function displayName(doc: Pick<UserDoc, 'name' | 'firstName' | 'lastName'>): string | null {
  if (doc.name) return doc.name
  const legacy = [doc.firstName, doc.lastName].filter(Boolean).join(' ').trim()
  return legacy || null
}

/** Upsert from a WorkOS user object already in hand — e.g. a fresh authenticate response. */
export async function ensureUser(user: WorkOSUserLike): Promise<void> {
  const db = await getDb()
  await db.collection<UserDoc>('users').updateOne(
    { _id: user.id },
    {
      // Email, its verified state, and avatar are authoritative in WorkOS, so
      // every sign-in refreshes them.
      $set: { email: user.email, emailVerified: user.emailVerified ?? true, avatarUrl: user.profilePictureUrl ?? null },
      // Name is authoritative in this app once set — a Google sign-in must not overwrite
      // a rename the user made here, so it's only ever seeded on first insert.
      $setOnInsert: {
        _id: user.id,
        name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null,
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
