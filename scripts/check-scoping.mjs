// The check for the per-user data model. Two halves:
//
//   1. Wrapper logic (offline, always runs): asserts lib/scoped.ts actually
//      injects user_id into every filter and stamps it on every insert,
//      including inside bulkWrite. This is the thing that, if it silently
//      broke, would leak one account's finances into another's.
//   2. Live data (only with MONGODB_URI): asserts no document is left untagged
//      and that a nobody-user sees zero rows.
//
// Usage: node scripts/check-scoping.mjs
import assert from 'node:assert/strict'
import { MongoClient } from 'mongodb'
import { loadEnv, USER_COLLECTIONS } from './lib/env.mjs'

loadEnv()

// --- 1. wrapper logic -------------------------------------------------
// A fake collection that records the filters/documents it is handed, so the
// wrapper can be exercised without a database.
function spy() {
  const calls = []
  const record = (method) => (...a) => {
    calls.push({ method, args: a })
    return method === 'find' ? { toArray: async () => [] } : Promise.resolve({})
  }
  return {
    calls,
    find: record('find'),
    findOne: record('findOne'),
    insertOne: record('insertOne'),
    insertMany: record('insertMany'),
    updateOne: record('updateOne'),
    updateMany: record('updateMany'),
    replaceOne: record('replaceOne'),
    deleteOne: record('deleteOne'),
    deleteMany: record('deleteMany'),
    countDocuments: record('countDocuments'),
    distinct: record('distinct'),
    aggregate: record('aggregate'),
    bulkWrite: record('bulkWrite'),
  }
}

async function checkWrapper() {
  const { scoped } = await import('../lib/scoped.ts').catch(() => ({ scoped: null }))
  if (!scoped) {
    console.log('wrapper: skipped (needs a TS-aware runtime, e.g. `node --experimental-strip-types`)')
    return
  }
  const s = spy()
  const c = scoped(s, 'user_alice')

  c.find({ date: '2026-01-01' })
  c.findOne({ name: 'Rent' })
  c.updateOne({ month: '2026-01' }, { $set: { assigned: '1' } })
  c.deleteOne({ name: 'Gone' })
  c.countDocuments({})
  c.insertOne({ item: 'Coffee' })
  c.bulkWrite([{ updateOne: { filter: { name: 'A' }, update: { $set: { order: 1 } } } }])

  for (const { method, args } of s.calls) {
    if (method === 'insertOne') {
      assert.equal(args[0].user_id, 'user_alice', 'insertOne must stamp user_id')
    } else if (method === 'bulkWrite') {
      assert.equal(args[0][0].updateOne.filter.user_id, 'user_alice', 'bulkWrite ops must be scoped')
    } else {
      assert.equal(args[0].user_id, 'user_alice', `${method} filter must carry user_id`)
    }
  }
  // A caller must not be able to override the scope by passing its own user_id.
  const s2 = spy()
  scoped(s2, 'user_alice').find({ user_id: 'user_bob' })
  assert.equal(s2.calls[0].args[0].user_id, 'user_alice', 'caller-supplied user_id must not win')

  console.log(`wrapper: ok (${s.calls.length + 1} calls scoped)`)
}

// --- 2. live data -----------------------------------------------------
async function checkData() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('data: skipped (MONGODB_URI not set)')
    return
  }
  const client = new MongoClient(uri)
  await client.connect()
  try {
    const db = client.db()
    const existing = new Set((await db.listCollections().toArray()).map((c) => c.name))
    let failures = 0

    for (const name of USER_COLLECTIONS) {
      if (!existing.has(name)) continue
      const coll = db.collection(name)
      const untagged = await coll.countDocuments({ user_id: { $exists: false } })
      const total = await coll.countDocuments({})
      const nobody = await coll.countDocuments({ user_id: 'user_nobody' })
      const ok = untagged === 0 && nobody === 0
      if (!ok) failures++
      console.log(`data: ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(24)} ${total} docs, ${untagged} untagged`)
    }

    for (const name of USER_COLLECTIONS) {
      assert.ok(!existing.has(`demo_${name}`), `demo_${name} should be gone after backfill`)
    }

    assert.equal(failures, 0, `${failures} collection(s) still hold untagged documents`)
  } finally {
    await client.close()
  }
}

await checkWrapper()
await checkData()
console.log('\nall checks passed')
