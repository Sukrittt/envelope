// Creates the per-user indexes the multi-user data model needs. Idempotent —
// createIndex is a no-op when the index already exists.
//
// Run AFTER backfill-user-id.mjs: the unique compound indexes would fail on
// documents that still have no user_id. Run BEFORE a second user exists: they
// are what make the app's duplicate checks (one holding named X, one budget row
// per month+category) correct per-account rather than globally.
//
// Usage: node scripts/ensure-indexes.mjs
import { MongoClient } from 'mongodb'
import { loadEnv } from './lib/env.mjs'

loadEnv()

const INDEXES = {
  expenses: [[{ user_id: 1, date: -1 }, {}]],
  budgets: [[{ user_id: 1, month: 1, category: 1 }, { unique: true }]],
  categories: [
    [{ user_id: 1, name: 1 }, { unique: true }],
    [{ user_id: 1, group: 1, order: 1 }, {}],
  ],
  groups: [[{ user_id: 1, name: 1 }, { unique: true }]],
  holdings: [[{ user_id: 1, name: 1 }, { unique: true }]],
  holding_events: [[{ user_id: 1, timestamp: -1 }, {}]],
  subscriptions: [[{ user_id: 1, service: 1 }, {}]],
  push_tokens: [
    [{ token: 1 }, { unique: true }],
    [{ user_id: 1 }, {}],
  ],
  category_map_overrides: [[{ user_id: 1, word: 1 }, { unique: true }]],
  chat_sessions: [[{ user_id: 1, updatedAt: -1 }, {}]],
  // TTL index: hits older than an hour (the longest window lib/rateLimit.ts
  // checks against) are garbage-collected automatically. Correctness never
  // depends on this running promptly — every check bounds by its own cutoff.
  rate_limit_hits: [
    [{ key: 1, ts: -1 }, {}],
    [{ ts: 1 }, { expireAfterSeconds: 3600 }],
  ],
  // Send-log dedupe for Smart Notifications: the unique compound index is
  // what makes a repeat `insertOne` throw E11000 for an already-sent key.
  // The TTL index reclaims rows after 90 days — well past any lead-day or
  // digest window, so nothing correctness-relevant depends on its timing.
  notification_log: [
    [{ user_id: 1, key: 1 }, { unique: true }],
    [{ sentAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }],
  ],
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db()
    for (const [name, specs] of Object.entries(INDEXES)) {
      for (const [keys, options] of specs) {
        try {
          const created = await db.collection(name).createIndex(keys, options)
          console.log(`${name.padEnd(24)} ${created}`)
        } catch (err) {
          console.error(`${name.padEnd(24)} FAILED ${JSON.stringify(keys)}: ${err.message}`)
        }
      }
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
