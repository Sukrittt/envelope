import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspace = path.resolve(__dirname, '..')

// --- Minimal .env.local loader for MONGODB_URI when run as a plain node script ---
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

// --- CSV helpers (mirrors scripts/sync_expenses.mjs, reopened here to avoid side effects) ---
function parseCsv(text) {
  const rows = []
  let row = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1]
        if (next === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(current)
      current = ''
      continue
    }
    if (char === '\n') {
      row.push(current)
      rows.push(row)
      row = []
      current = ''
      continue
    }
    if (char === '\r') continue
    current += char
  }
  if (current.length || row.length) {
    row.push(current)
    rows.push(row)
  }
  return rows
}

function readCsvAsObjects(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] }
  const text = fs.readFileSync(filePath, 'utf8').trim()
  if (!text) return { headers: [], rows: [] }
  const parsed = parseCsv(text)
  const headers = parsed.shift() ?? []
  const rows = parsed.map((row) => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? ''
    })
    return obj
  })
  return { headers, rows }
}

// --- Migration config ---
// Demo rows no longer go to demo_* collections: demo is just another user id,
// so both sets seed the same collections and are separated by `user_id`.
//
// The real user id must be passed explicitly (--user-id user_xxx, or the
// WORKOS_USER_ID env var). Seeding untagged documents would leave rows nobody
// can read, so there is deliberately no default.
const REAL_USER_ID =
  process.argv.includes('--user-id')
    ? process.argv[process.argv.indexOf('--user-id') + 1]
    : process.env.WORKOS_USER_ID
const DEMO_USER_ID = process.env.DEMO_USER_ID || 'demo'

// target collection -> { file, key (natural key string or array), log (append-only) }
const COLLECTION_MAP = [
  { collection: 'expenses', userId: REAL_USER_ID, file: path.join(workspace, 'productivity', 'expenses.csv'), key: 'log' },
  { collection: 'budgets', userId: REAL_USER_ID, file: path.join(workspace, 'productivity', 'budgets.csv'), key: ['month', 'category'] },
  { collection: 'categories', userId: REAL_USER_ID, file: path.join(workspace, 'productivity', 'categories.csv'), key: 'name' },
  { collection: 'groups', userId: REAL_USER_ID, file: path.join(workspace, 'productivity', 'groups.csv'), key: 'name' },
  { collection: 'subscriptions', userId: REAL_USER_ID, file: path.join(workspace, 'data', 'subscriptions.csv'), key: 'service' },
  { collection: 'holdings', userId: REAL_USER_ID, file: path.join(workspace, 'data', 'holdings.csv'), key: 'name' },
  { collection: 'holding_events', userId: REAL_USER_ID, file: path.join(workspace, 'data', 'holding_events.csv'), key: 'log' },
  { collection: 'expenses', userId: DEMO_USER_ID, file: path.join(workspace, 'productivity', 'demo', 'expenses.csv'), key: 'log' },
  { collection: 'budgets', userId: DEMO_USER_ID, file: path.join(workspace, 'productivity', 'demo', 'budgets.csv'), key: ['month', 'category'] },
  { collection: 'categories', userId: DEMO_USER_ID, file: path.join(workspace, 'productivity', 'demo', 'categories.csv'), key: 'name' },
  { collection: 'groups', userId: DEMO_USER_ID, file: path.join(workspace, 'productivity', 'demo', 'groups.csv'), key: 'name' },
  { collection: 'subscriptions', userId: DEMO_USER_ID, file: path.join(workspace, 'data', 'demo', 'subscriptions.csv'), key: 'service' },
  { collection: 'holdings', userId: DEMO_USER_ID, file: path.join(workspace, 'data', 'demo', 'holdings.csv'), key: 'name' },
  { collection: 'holding_events', userId: DEMO_USER_ID, file: path.join(workspace, 'data', 'demo', 'holding_events.csv'), key: 'log' },
]

function buildFilter(row, key, userId) {
  if (key === 'log') return null
  const filter = { user_id: userId }
  const keys = Array.isArray(key) ? key : [key]
  for (const k of keys) filter[k] = row[k]
  return filter
}

async function seedCollection(db, config) {
  const { rows } = readCsvAsObjects(config.file)
  if (!rows.length) {
    console.log(`  - ${config.collection}: no rows (file missing/empty)` )
    return 0
  }
  const coll = db.collection(config.collection)
  const userId = config.userId

  // Categories need a stable order field for the envelope grid.
  let isCategories = config.collection.endsWith('categories')

  if (config.key === 'log') {
    // Only this user's rows — the collection is shared across users now.
    await coll.deleteMany({ user_id: userId })
  }

  let inserted = 0
  let updated = 0
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const order = isCategories ? i : i
    const doc = isCategories ? { ...row, order, user_id: userId } : { ...row, user_id: userId }

    if (config.key === 'log') {
      await coll.insertOne(doc)
      inserted += 1
      continue
    }

    const filter = buildFilter(row, config.key, userId)
    const result = await coll.replaceOne(filter, doc, { upsert: true })
    if (result.upsertedCount > 0) inserted += 1
    else if (result.modifiedCount > 0) updated += 1
  }
  console.log(`  - ${config.collection} [${userId}]: ${inserted} inserted, ${updated} updated (${rows.length} total)`)
  return rows.length
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to .env.local or the environment, then re-run.')
    process.exit(1)
  }

  if (!REAL_USER_ID) {
    console.error('Pass --user-id user_xxx (or set WORKOS_USER_ID). Documents must be owned by a user.')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db()
    console.log(`Seeding database "${db.databaseName}" from CSV files...`)
    for (const config of COLLECTION_MAP) {
      await seedCollection(db, config)
    }
    console.log('Migration complete.')
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})