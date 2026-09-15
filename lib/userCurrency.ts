import { getDb } from './mongodb'
import type { UserDoc } from './users'
import { resolveCurrency } from '@/src/lib/currencies'

/** Read once per server operation; never keep a process-global user preference. */
export async function getUserCurrency(userId: string): Promise<string> {
  const db = await getDb()
  const user = await db.collection<UserDoc>('users').findOne({ _id: userId }, { projection: { currencyCode: 1 } })
  return resolveCurrency(user?.currencyCode)
}
