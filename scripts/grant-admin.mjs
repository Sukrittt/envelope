// Grants (or with --revoke, removes) /admin access for one user by email.
// The only way to become an admin — no route ever writes `isAdmin`.
//
// Usage: npm run admin:grant -- --email you@example.com [--revoke]
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
  const update = revoke ? { $unset: { isAdmin: '' } } : { $set: { isAdmin: true } }
  const result = await users.updateOne({ email: String(email), deleted_at: null }, update, { collation: { locale: 'en', strength: 2 } })
  if (result.matchedCount === 0) throw new Error(`no live user with email ${email}`)
  console.log(`${revoke ? 'revoked' : 'granted'} admin for ${email}`)
} finally {
  await client.close()
}
