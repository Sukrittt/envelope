import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { COLLECTIONS } from '@/lib/models'
import type { UserDoc } from '@/lib/users'
import { AI_USAGE, type AiUsageDoc } from '@/lib/ai/usage'
import { DailyBars } from './DailyBars'
import { daysAgo, fmtBytes, num, usd } from './format'

const TZ = 'Asia/Kolkata'

type DayCount = { _id: string; n: number }
const toMap = (rows: DayCount[]) => new Map(rows.map((r) => [r._id, r.n]))

function Kpi({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi-label">{label}</div>
      <div className="adm-kpi-value">{typeof value === 'number' ? num(value) : value}</div>
      {note && <div className="adm-kpi-note">{note}</div>}
    </div>
  )
}

/** Per-collection doc count and storage size. `$collStats` isn't allowed on every Atlas tier, so size is best-effort. */
async function collectionStats(db: Awaited<ReturnType<typeof getDb>>) {
  const names = ['users', ...Object.values(COLLECTIONS)]
  return Promise.all(
    names.map(async (name) => {
      const coll = db.collection(name)
      const count = await coll.estimatedDocumentCount()
      let size: number | null = null
      try {
        const [stats] = await coll.aggregate<{ storageStats: { size: number } }>([{ $collStats: { storageStats: {} } }]).toArray()
        size = stats?.storageStats.size ?? null
      } catch {
        // not permitted on this cluster tier
      }
      return { name, count, size }
    }),
  )
}

export default async function AdminOverview() {
  const db = await getDb()
  const users = db.collection<UserDoc>('users')
  const live = { deleted_at: null }

  const [total, new7, new30, active1, active7, active30, pendingDelete, signups, expensesPerDay, collections, [ai]] = await Promise.all([
    users.countDocuments(live),
    users.countDocuments({ ...live, createdAt: { $gte: daysAgo(7) } }),
    users.countDocuments({ ...live, createdAt: { $gte: daysAgo(30) } }),
    users.countDocuments({ ...live, lastSeenAt: { $gte: daysAgo(1) } }),
    users.countDocuments({ ...live, lastSeenAt: { $gte: daysAgo(7) } }),
    users.countDocuments({ ...live, lastSeenAt: { $gte: daysAgo(30) } }),
    users.countDocuments({ deleted_at: { $ne: null } }),
    users
      .aggregate<DayCount>([
        { $match: { createdAt: { $gte: daysAgo(90) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    // Creation time from the ObjectId, not `date` — `date` is when the spend happened, which can be backdated.
    db
      .collection(COLLECTIONS.expenses)
      .aggregate<DayCount>([
        { $match: { _id: { $gte: objectIdAt(daysAgo(30)) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$_id' }, timezone: TZ } }, n: { $sum: 1 } } },
      ])
      .toArray(),
    collectionStats(db),
    db
      .collection<AiUsageDoc>(AI_USAGE)
      .aggregate<{ calls: number; cost: number }>([
        { $match: { at: { $gte: daysAgo(30) } } },
        { $group: { _id: null, calls: { $sum: 1 }, cost: { $sum: { $ifNull: ['$costUsd', 0] } } } },
      ])
      .toArray(),
  ])

  return (
    <>
      <div className="adm-head">
        <h1>Overview</h1>
        <span className="adm-sub">Live from MongoDB · active = last authenticated request</span>
      </div>

      <div className="adm-grid">
        <Kpi label="Users" value={total} />
        <Kpi label="New · 7d" value={new7} note={`${num(new30)} in 30d`} />
        <Kpi label="Active · 24h" value={active1} />
        <Kpi label="Active · 7d" value={active7} />
        <Kpi label="Active · 30d" value={active30} />
        <Kpi label="Pending deletion" value={pendingDelete} />
        <Kpi label="AI cost · 30d" value={usd(ai?.cost ?? 0)} note={`${num(ai?.calls ?? 0)} calls`} />
      </div>

      <div className="adm-two">
        <section className="erd-card">
          <h2>Signups</h2>
          <DailyBars counts={toMap(signups)} days={90} unit="signups" />
        </section>
        <section className="erd-card">
          <h2>Transactions logged</h2>
          <DailyBars counts={toMap(expensesPerDay)} days={30} unit="transactions" />
        </section>
      </div>

      <section className="erd-card">
        <h2>Collections</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th className="num">Documents</th>
                <th className="num">Size</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.name}>
                  <td className="adm-mono">{c.name}</td>
                  <td className="num">{num(c.count)}</td>
                  <td className="num">{c.size === null ? '—' : fmtBytes(c.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function objectIdAt(date: Date) {
  return ObjectId.createFromTime(Math.floor(date.getTime() / 1000))
}
