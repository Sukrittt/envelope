import { json, error, readBody } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { getWorkOSClient } from '@/lib/workosClient'
import { scoped } from '@/lib/scoped'
import { COLLECTIONS } from '@/lib/models'
import { displayName, type UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

function serialize(user: UserDoc | null) {
  if (!user) return null
  return { ...user, name: displayName(user), emailVerified: user.emailVerified ?? true }
}

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const db = await getDb()
  const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
  return json(serialize(user))
}

export async function PATCH(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const body = await readBody(req)
  const name = typeof body.name === 'string' ? body.name.trim() : undefined

  const updates: Partial<
    Pick<
      UserDoc,
      'name' | 'onboardedAt' | 'notifyCadence' | 'notifyThresholdPct' | 'notifyBills' | 'notifyBillLeadDays' | 'notifyCoach'
    >
  > = {}
  if (name !== undefined) updates.name = name || null
  if (typeof body.onboardedAt === 'string' || body.onboardedAt === null) updates.onboardedAt = body.onboardedAt as string | null
  if (body.notifyCadence === 'off' || body.notifyCadence === 'weekly' || body.notifyCadence === 'daily') {
    updates.notifyCadence = body.notifyCadence
  }
  if (typeof body.notifyThresholdPct === 'number' && body.notifyThresholdPct >= 0 && body.notifyThresholdPct <= 100) {
    updates.notifyThresholdPct = body.notifyThresholdPct
  }
  if (typeof body.notifyBills === 'boolean') updates.notifyBills = body.notifyBills
  if (typeof body.notifyBillLeadDays === 'number' && body.notifyBillLeadDays >= 0 && body.notifyBillLeadDays <= 30) {
    updates.notifyBillLeadDays = body.notifyBillLeadDays
  }
  if (typeof body.notifyCoach === 'boolean') updates.notifyCoach = body.notifyCoach
  if (Object.keys(updates).length === 0) return error('no valid fields')

  if (name !== undefined) {
    await getWorkOSClient().userManagement.updateUser({ userId: auth.userId, name: name || undefined })
  }

  const db = await getDb()
  await db.collection<UserDoc>('users').updateOne({ _id: auth.userId }, { $set: updates })
  const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
  return json(serialize(user))
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const body = await readBody(req)
  const confirmEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  const db = await getDb()
  // The client already gates the delete button on the typed email matching
  // the account's own — this re-checks it server-side, since that's the only
  // check that actually stops a direct API call (the old body.confirm===true
  // check was one curl call away from irreversible).
  const account = await db.collection<UserDoc>('users').findOne({ _id: auth.userId }, { projection: { email: 1 } })
  if (!account?.email || !confirmEmail || confirmEmail !== account.email.toLowerCase()) {
    return error('email confirmation required', 400)
  }

  for (const name of Object.values(COLLECTIONS)) {
    await scoped(db.collection(name), auth.userId).deleteMany({})
  }
  await db.collection<UserDoc>('users').deleteOne({ _id: auth.userId })
  await getWorkOSClient().userManagement.deleteUser(auth.userId)

  return json({ ok: true })
}
