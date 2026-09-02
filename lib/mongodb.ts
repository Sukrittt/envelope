import { MongoClient, type Db, type ClientSession } from 'mongodb'

const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

/**
 * Return a cached MongoClient connected to MONGODB_URI.
 *
 * The client is cached on `globalThis` so hot-reloads (dev) and repeated
 * route-handler invocations reuse a single connection pool. The connection is
 * created lazily so `next build` does not require MONGODB_URI to be present.
 */
export async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not defined. Set it in .env.local or the deployment environment.')
  }
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri)
    globalWithMongo._mongoClientPromise = client.connect()
  }
  return globalWithMongo._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClient()
  return client.db()
}

/**
 * Runs `fn` inside a multi-document transaction. `withTransaction` retries
 * the whole callback on a transient error (e.g. write conflict), so `fn`
 * must be pure DB writes — no cache invalidation, no push notifications,
 * nothing with a side effect outside Mongo. Run those after this resolves.
 */
export async function withTx<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getClient()
  const session = client.startSession()
  try {
    let result: T
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result!
  } finally {
    await session.endSession()
  }
}
