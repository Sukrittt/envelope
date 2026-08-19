// One-off / re-runnable sync of WorkOS users into the local `users` collection.
// New sign-ins upsert themselves via lib/users.ts — this script exists for two
// cases that path doesn't cover: seeding accounts that signed in before this
// feature shipped, and manually pulling in edits made in the WorkOS dashboard.
//
// Usage: node scripts/sync-users.mjs
import { MongoClient } from 'mongodb'
import { loadEnv } from './lib/env.mjs'

loadEnv()

async function fetchAllUsers(apiKey) {
  const users = []
  let after
  do {
    const url = new URL('https://api.workos.com/user_management/users')
    url.searchParams.set('limit', '100')
    if (after) url.searchParams.set('after', after)
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!resp.ok) throw new Error(`WorkOS user list failed: ${resp.status} ${await resp.text()}`)
    const body = await resp.json()
    users.push(...body.data)
    after = body.list_metadata?.after
  } while (after)
  return users
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  const apiKey = process.env.WORKOS_API_KEY
  if (!apiKey) throw new Error('WORKOS_API_KEY not set')

  const users = await fetchAllUsers(apiKey)
  console.log(`${users.length} WorkOS user(s) found\n`)

  const client = new MongoClient(uri)
  await client.connect()
  try {
    const coll = client.db().collection('users')
    for (const u of users) {
      await coll.updateOne(
        { _id: u.id },
        {
          $set: { email: u.email, firstName: u.first_name ?? null, lastName: u.last_name ?? null },
          $setOnInsert: { _id: u.id, createdAt: new Date() },
        },
        { upsert: true },
      )
      console.log(`   ${u.email.padEnd(32)} ${u.id}`)
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
