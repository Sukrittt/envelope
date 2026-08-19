// One-time backfill for the timezone bug fixed in app/api/expenses/route.ts and
// app/api/subscriptions/route.ts (see lib/http.ts::nowIST). Every timestamp the
// server generated before that fix has UTC clock digits mislabeled as +05:30 —
// this script re-derives the real IST digits from what's actually stored.
//
// Usage:
//   node scripts/backfill-timestamp-timezone.mjs           # dry run, prints planned changes
//   node scripts/backfill-timestamp-timezone.mjs --apply   # actually writes
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..')

try {
  const envPath = path.join(workspace, '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
} catch {
  // ignore
}

const APPLY = process.argv.includes('--apply')
const TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})\+05:30$/

// Bug: stored digits are the server's raw UTC clock at insert time, mislabeled
// +05:30. Correct: treat those digits as UTC, then shift forward by 5.5h to
// get the real IST wall-clock instant.
function correctedTimestamp(raw) {
  const m = TIMESTAMP_RE.exec(raw)
  if (!m) return null
  const asUtc = new Date(`${m[1]}T${m[2]}Z`)
  if (Number.isNaN(asUtc.getTime())) return null
  const corrected = new Date(asUtc.getTime() + 5.5 * 60 * 60 * 1000)
  const iso = corrected.toISOString()
  return { date: iso.slice(0, 10), timestamp: `${iso.slice(0, 19)}+05:30` }
}

async function backfillCollection(db, name, { fixDate }) {
  const coll = db.collection(name)
  const docs = await coll.find({ timestamp: { $exists: true, $type: 'string' } }).toArray()

  let changed = 0
  let skipped = 0
  const ops = []
  const samples = []

  for (const doc of docs) {
    const result = correctedTimestamp(String(doc.timestamp))
    if (!result || result.timestamp === doc.timestamp) {
      skipped += 1
      continue
    }
    const set = { timestamp: result.timestamp }
    if (fixDate && typeof doc.date === 'string' && doc.date !== result.date) {
      set.date = result.date
    }
    if (samples.length < 5) {
      samples.push({ _id: doc._id, before: { timestamp: doc.timestamp, date: doc.date }, after: set })
    }
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } })
    changed += 1
  }

  console.log(`\n${name}: ${docs.length} docs, ${changed} to correct, ${skipped} already correct/unrecognized`)
  for (const s of samples) {
    console.log('  sample:', JSON.stringify(s))
  }

  if (APPLY && ops.length > 0) {
    const res = await coll.bulkWrite(ops)
    console.log(`  applied: ${res.modifiedCount} modified`)
  }
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not defined. Set it in .env.local.')
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db()

  console.log(APPLY ? 'APPLY mode — writing changes' : 'DRY RUN — no writes (pass --apply to write)')
  await backfillCollection(db, 'expenses', { fixDate: true })
  await backfillCollection(db, 'subscriptions', { fixDate: false })

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
