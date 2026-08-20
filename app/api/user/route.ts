import { json, error, readBody } from '@/lib/http'
import { getAuth } from '@/lib/access'
import { getDb } from '@/lib/mongodb'
import { getWorkOSClient } from '@/lib/workosClient'
import { scoped } from '@/lib/scoped'
import { COLLECTIONS } from '@/lib/models'
import type { UserDoc } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const db = await getDb()
  const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
  return json(user)
}

export async function PATCH(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const body = (await readBody(req)) as Record<string, unknown>
  const firstName = typeof body.firstName === 'string' ? body.firstName : undefined
  const lastName = typeof body.lastName === 'string' ? body.lastName : undefined

  const updates: Partial<Pick<UserDoc, 'firstName' | 'lastName' | 'onboardedAt' | 'notifyCadence'>> = {}
  if (firstName !== undefined) updates.firstName = firstName
  if (lastName !== undefined) updates.lastName = lastName
  if (typeof body.onboardedAt === 'string' || body.onboardedAt === null) updates.onboardedAt = body.onboardedAt as string | null
  if (body.notifyCadence === 'off' || body.notifyCadence === 'weekly' || body.notifyCadence === 'daily') {
    updates.notifyCadence = body.notifyCadence
  }
  if (Object.keys(updates).length === 0) return error('no valid fields')

  if (firstName !== undefined || lastName !== undefined) {
    await getWorkOSClient().userManagement.updateUser({
      userId: auth.userId,
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
    })
  }

  const db = await getDb()
  await db.collection<UserDoc>('users').updateOne({ _id: auth.userId }, { $set: updates })
  const user = await db.collection<UserDoc>('users').findOne({ _id: auth.userId })
  return json(user)
}

export async function DELETE(req: Request) {
  const auth = await getAuth(req)
  if (auth.readOnly) return error('unauthorized', 401)

  const body = (await readBody(req)) as Record<string, unknown>
  if (body.confirm !== true) return error('confirm required', 400)

  const db = await getDb()
  for (const name of Object.values(COLLECTIONS)) {
    await scoped(db.collection(name), auth.userId).deleteMany({})
  }
  await db.collection<UserDoc>('users').deleteOne({ _id: auth.userId })
  await getWorkOSClient().userManagement.deleteUser(auth.userId)

  return json({ ok: true })
}
