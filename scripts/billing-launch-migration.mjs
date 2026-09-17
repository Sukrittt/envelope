// Grants every existing onboarded user one fresh 45-day trial at the public
// subscriptions launch instant.
//
// Not counted from account creation, from the deploy, or from an old
// `onboardedAt` — pricing.md promises existing users a *fresh* 45 days, and
// anchoring to any historical date would hand some of them an already-dead
// trial on day one.
//
// The launch instant is passed in explicitly and recorded on every row, so
// reruns (a crash halfway, a second invocation, a retry after a network
// blip) are idempotent: `$setOnInsert` under the user-id primary key means an
// account that already has a trial keeps the dates it already has. A trial
// clock is never restarted by this script.
//
// Usage:
//   node scripts/billing-launch-migration.mjs --at 2026-10-01T00:00:00Z --dry-run
//   node scripts/billing-launch-migration.mjs --at 2026-10-01T00:00:00Z
//
// Run the dry run first and check the count against the admin user list.
// Run this BEFORE flipping system_settings.billing.enforced — with
// enforcement on and this unrun, every existing user is locked out.
import { MongoClient } from 'mongodb'
import { loadEnv, args } from './lib/env.mjs'

loadEnv()
const argv = args()
const DRY = Boolean(argv['dry-run'])
const TRIAL_DAYS = 45
const COHORT = 'legacy-launch-v1'

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set')
if (!argv.at) throw new Error('--at <ISO instant> is required — the launch instant every legacy trial starts from')
const startedAt = new Date(argv.at)
if (Number.isNaN(startedAt.getTime())) throw new Error(`--at is not a valid instant: ${argv.at}`)
const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
try {
  const db = client.db()
  // Deleted accounts are excluded: they are in a grace window awaiting purge,
  // and granting them a trial would resurrect billing state for a user who
  // asked to leave. Un-onboarded accounts are excluded too — completing
  // onboarding is what starts their clock, the normal way.
  const cohort = await db
    .collection('users')
    .find({ deleted_at: null, onboardedAt: { $nin: [null, undefined] } }, { projection: { _id: 1 } })
    .toArray()

  const existing = new Set(
    (await db.collection('billing_accounts').find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id),
  )
  const toGrant = cohort.filter((u) => !existing.has(u._id))

  console.log(`cohort: ${cohort.length} onboarded live user(s); ${existing.size} already have a billing account`)
  console.log(`trial window: ${startedAt.toISOString()} → ${endsAt.toISOString()} (${TRIAL_DAYS} days, cohort ${COHORT})`)

  if (DRY) {
    console.log(`would grant a fresh trial to ${toGrant.length} user(s)`)
    for (const u of toGrant.slice(0, 20)) console.log(`  ${u._id}`)
    if (toGrant.length > 20) console.log(`  … and ${toGrant.length - 20} more`)
  } else if (toGrant.length > 0) {
    const now = new Date()
    const result = await db.collection('billing_accounts').bulkWrite(
      toGrant.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: {
            $setOnInsert: {
              _id: u._id,
              trialStartedAt: startedAt,
              trialEndsAt: endsAt,
              trialCohort: COHORT,
              createdAt: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    )
    console.log(`granted ${result.upsertedCount} trial(s); ${toGrant.length - result.upsertedCount} already existed`)
  } else {
    console.log('nothing to grant')
  }
} finally {
  await client.close()
}
