import { getDb } from './mongodb'

const RATE_LIMIT_COLLECTION = 'rate_limit_hits'

type RateLimitHit = { key: string; ts: Date }

/**
 * Sliding-window rate limiter backed by Mongo, so it survives cold starts and
 * is shared across serverless instances — unlike a per-instance in-memory Map
 * (the shape app/api/ai/chat/route.ts used before this existed).
 *
 * One document per hit rather than an array-per-key: a TTL index on `ts`
 * (see scripts/ensure-indexes.mjs) garbage-collects old hits automatically,
 * so there's no pruning logic here — `countDocuments` with a `$gte` cutoff is
 * always correct regardless of how stale the TTL cleanup is running behind.
 *
 * Not perfectly atomic under concurrent requests for the same key (a count
 * then an insert, not a single atomic op) — a burst of parallel requests can
 * overshoot the limit by a few. Accepted: this is an abuse-rate control on a
 * low-traffic personal app, not a hard billing quota.
 */
export async function isRateLimited(key: string, opts: { windowMs: number; limit: number }): Promise<boolean> {
  const db = await getDb()
  const coll = db.collection<RateLimitHit>(RATE_LIMIT_COLLECTION)
  const cutoff = new Date(Date.now() - opts.windowMs)

  const count = await coll.countDocuments({ key, ts: { $gte: cutoff } })
  if (count >= opts.limit) return true

  await coll.insertOne({ key, ts: new Date() })
  return false
}

/**
 * Best-effort client IP for rate-limit keys on routes with no session (e.g.
 * magic-auth) — Vercel sets x-forwarded-for; falls back to a shared bucket
 * key when absent (local dev, or a proxy that strips it) rather than throwing.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
