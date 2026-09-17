// Seeds `notifyCadence: 'daily'` on live users who never had the field set.
//
// Signup didn't write a cadence until lib/users.ts started seeding it, and
// prefsFor() reads a missing field as 'off' — so those accounts never got a
// digest. Only docs missing the field are touched: anyone who picked 'off',
// 'weekly' or 'daily' keeps their choice. Idempotent.
//
// Usage:
//   node scripts/backfill-notify-cadence.mjs --dry-run
//   node scripts/backfill-notify-cadence.mjs
import { MongoClient } from 'mongodb'
import { loadEnv, args } from './lib/env.mjs'

loadEnv()
const DRY = Boolean(args()['dry-run'])
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set')

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const users = client.db().collection('users')
  const filter = { notifyCadence: { $exists: false }, deleted_at: null }
  const count = await users.countDocuments(filter)
  if (DRY) {
    console.log(`would set notifyCadence=daily on ${count} user(s)`)
  } else {
    const result = await users.updateMany(filter, { $set: { notifyCadence: 'daily' } })
    console.log(`set notifyCadence=daily on ${result.modifiedCount} of ${count} user(s)`)
  }
} finally {
  await client.close()
}
