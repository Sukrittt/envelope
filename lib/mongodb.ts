import { MongoClient, type Db } from 'mongodb'

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
