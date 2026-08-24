// The check for the per-user data model, against live data (only runs with
// MONGODB_URI): asserts no document is left untagged and that a nobody-user
// sees zero rows.
//
// The offline half of this check — that lib/scoped.ts actually injects
// user_id into every filter and stamps it on every insert, including inside
// bulkWrite — now lives in lib/scoped.test.ts (`npm test`), since that needs
// no database and belongs in the regular test suite.
//
// Usage: node scripts/check-scoping.mjs
import assert from 'node:assert/strict'
import { MongoClient } from 'mongodb'
import { loadEnv, USER_COLLECTIONS } from './lib/env.mjs'

loadEnv()

// --- live data ----------------------------------------------------------
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

await checkData()
console.log('\nall checks passed')
