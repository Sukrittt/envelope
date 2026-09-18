// Grants (or with --revoke, removes) billing-tester status for one user by email.
// Testers are the only users the billing switches reach while `billing.audience` is `testers` (see lib/billing/flags.ts). No route ever writes `billingTester`.
//
// Usage: npm run billing:tester -- --email tester@example.com [--revoke]
import { MongoClient } from 'mongodb'
import { loadEnv, args } from './lib/env.mjs'

loadEnv()

const { email, revoke } = args()
if (!email || email === true) throw new Error('--email required')
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set')

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const users = client.db().collection('users')
  const update = revoke ? { $unset: { billingTester: '' } } : { $set: { billingTester: true } }
  const result = await users.updateOne({ email: String(email), deleted_at: null }, update, { collation: { locale: 'en', strength: 2 } })
  if (result.matchedCount === 0) throw new Error(`no live user with email ${email}`)
  console.log(`${revoke ? 'revoked' : 'granted'} billing tester for ${email}`)
} finally {
  await client.close()
}
