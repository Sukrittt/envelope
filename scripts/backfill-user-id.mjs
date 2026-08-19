// One-time migration to per-user data, for the WorkOS auth change.
//
// Three idempotent passes:
//   1. Tag every untagged document in the real collections with your user id.
//   2. Absorb the demo_* collections into the real ones under the demo user id,
//      then drop them — demo is now just another account, not a name prefix.
//   3. Reshape category_map_overrides: its `_id` used to BE the lowercased word,
//      which made the word a globally unique key. Move it to a `word` field.
//
// Safe to re-run: pass 1 only touches documents missing user_id, pass 2 skips a
// collection that already has demo rows, pass 3 skips docs that already have
// `word`.
//
// Usage:
//   node scripts/backfill-user-id.mjs --dry-run --email you@example.com
//   node scripts/backfill-user-id.mjs --user-id user_xxx --demo-user-id demo
//
// --email looks the id up via the WorkOS API (needs WORKOS_API_KEY), so you
// never have to copy a user id out of the dashboard by hand.
import { MongoClient } from 'mongodb'
import { loadEnv, args, USER_COLLECTIONS } from './lib/env.mjs'

loadEnv()
const opts = args()
const DRY = Boolean(opts['dry-run'])
const DEMO_USER_ID = opts['demo-user-id'] || process.env.DEMO_USER_ID || 'demo'

async function resolveUserId() {
  if (opts['user-id']) return opts['user-id']
  const email = opts.email
  if (!email) {
    throw new Error('Pass --user-id user_xxx or --email you@example.com')
  }
  const key = process.env.WORKOS_API_KEY
  if (!key) throw new Error('WORKOS_API_KEY not set — needed to look up --email')

  const resp = await fetch(
    `https://api.workos.com/user_management/users?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  )
  if (!resp.ok) throw new Error(`WorkOS user lookup failed: ${resp.status} ${await resp.text()}`)
  const { data } = await resp.json()
  if (!data?.length) {
    throw new Error(`No WorkOS user with email ${email}. Sign in once first, or create them in the dashboard.`)
  }
  return data[0].id
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  const userId = await resolveUserId()
  if (userId === DEMO_USER_ID) throw new Error('--user-id and --demo-user-id must differ')

  console.log(`${DRY ? '[dry run] ' : ''}real user: ${userId}   demo user: ${DEMO_USER_ID}\n`)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  try {
    const existing = new Set((await db.listCollections().toArray()).map((c) => c.name))

    // --- Pass 1: claim untagged real data -------------------------------
    console.log('1. claiming untagged documents')
    for (const name of USER_COLLECTIONS) {
      if (!existing.has(name)) {
        console.log(`   ${name.padEnd(24)} (absent)`)
        continue
      }
      const coll = db.collection(name)
      const filter = { user_id: { $exists: false } }
      const count = await coll.countDocuments(filter)
      if (count && !DRY) await coll.updateMany(filter, { $set: { user_id: userId } })
      console.log(`   ${name.padEnd(24)} ${count} tagged`)
    }

    // --- Pass 2: absorb demo_* ------------------------------------------
    console.log('\n2. absorbing demo_* collections')
    for (const name of USER_COLLECTIONS) {
      const demoName = `demo_${name}`
      if (!existing.has(demoName)) {
        console.log(`   ${demoName.padEnd(24)} (absent)`)
        continue
      }
      const target = db.collection(name)
      const already = await target.countDocuments({ user_id: DEMO_USER_ID })
      if (already > 0) {
        console.log(`   ${demoName.padEnd(24)} skipped (${already} demo rows already present)`)
        continue
      }
      const docs = await db.collection(demoName).find({}).toArray()
      const rows = docs.map(({ _id, ...rest }) => ({ ...rest, user_id: DEMO_USER_ID }))
      if (rows.length && !DRY) await target.insertMany(rows)
      if (!DRY) await db.collection(demoName).drop()
      console.log(`   ${demoName.padEnd(24)} ${rows.length} moved into ${name}, dropped`)
    }

    // --- Pass 3: reshape category_map_overrides -------------------------
    console.log('\n3. reshaping category_map_overrides')
    if (existing.has('category_map_overrides')) {
      const coll = db.collection('category_map_overrides')
      const stale = await coll.find({ word: { $exists: false } }).toArray()
      const rewritable = stale.filter((d) => typeof d._id === 'string')
      if (rewritable.length && !DRY) {
        await coll.insertMany(
          rewritable.map(({ _id, ...rest }) => ({ ...rest, word: String(_id) })),
        )
        await coll.deleteMany({ _id: { $in: rewritable.map((d) => d._id) } })
      }
      console.log(`   ${rewritable.length} rewritten (${stale.length - rewritable.length} skipped, non-string _id)`)
    } else {
      console.log('   (absent)')
    }

    console.log(DRY ? '\nDry run — nothing written.' : '\nDone.')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
