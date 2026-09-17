import { isCurrencyCode, resolveCurrency } from '@/src/lib/currencies'
import { json, error, readBody } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { getWorkOSClient } from '@/lib/workosClient'
import { displayName, type UserDoc } from '@/lib/users'
import { purgesAt } from '@/lib/archive'
import { softDeleteAccount } from '@/lib/accountLifecycle'

export const dynamic = 'force-dynamic'

function serialize(user: UserDoc | null) {
  if (!user) return null
  return {
    ...user,
    currencyCode: resolveCurrency(user.currencyCode),
    name: displayName(user),
    emailVerified: user.emailVerified ?? true,
    deletionScheduledFor: user.deleted_at ? purgesAt(user.deleted_at) : null,
  }
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
      | 'currencyCode'
      | 'name'
      | 'onboardedAt'
      | 'notifyCadence'
      | 'notifyThresholds'
      | 'notifyBills'
      | 'notifyBillLeadDays'
      | 'notifyCoach'
      | 'notifyWrapped'
    >
  > = {}
  if ('currencyCode' in body) {
    if (!isCurrencyCode(body.currencyCode)) return error('invalid currency code')
    updates.currencyCode = body.currencyCode
  }
  if (name !== undefined) updates.name = name || null
  if (typeof body.onboardedAt === 'string' || body.onboardedAt === null) updates.onboardedAt = body.onboardedAt as string | null
  if (body.notifyCadence === 'off' || body.notifyCadence === 'weekly' || body.notifyCadence === 'daily') {
    updates.notifyCadence = body.notifyCadence
  }
  if (typeof body.notifyThresholds === 'boolean') updates.notifyThresholds = body.notifyThresholds
  if (typeof body.notifyBills === 'boolean') updates.notifyBills = body.notifyBills
  if (typeof body.notifyBillLeadDays === 'number' && body.notifyBillLeadDays >= 0 && body.notifyBillLeadDays <= 30) {
    updates.notifyBillLeadDays = body.notifyBillLeadDays
  }
  if (typeof body.notifyCoach === 'boolean') updates.notifyCoach = body.notifyCoach
  if (typeof body.notifyWrapped === 'boolean') updates.notifyWrapped = body.notifyWrapped
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

  // Soft delete, same as every other DELETE route (lib/scoped.ts) — a
  // recoverable grace window, not an immediate wipe. See lib/accountLifecycle.ts.
  const deletedAt = await softDeleteAccount(db, auth.userId)

  return json({ ok: true, deletionScheduledFor: purgesAt(deletedAt) })
}
