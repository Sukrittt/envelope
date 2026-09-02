import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => ({ userId: 'user_a', readOnly: false, sessionId: null })),
  readOnlyGuard: vi.fn(() => null),
}))

vi.mock('@/lib/cache', () => ({ invalidate: vi.fn() }))
vi.mock('@/lib/categoryMap', () => ({ invalidateCategoryMap: vi.fn() }))

type Doc = Record<string, unknown> & { _id: ObjectId }
const stores: Record<string, Doc[]> = { expenses: [], categories: [] }

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '_id' && v instanceof ObjectId) return doc._id.equals(v)
    if (v === null) return doc[k] == null
    if (v && typeof v === 'object' && '$ne' in (v as object)) return doc[k] !== (v as { $ne: unknown }).$ne
    return doc[k] === v
  })
}

function fakeCollection(base: string) {
  const store = (stores[base] ??= [])
  return {
    find: (filter: Record<string, unknown> = {}) => ({
      toArray: async () => store.filter((d) => matches(d, filter)),
    }),
    findOne: async (filter: Record<string, unknown>, _options?: unknown, scopeOpts?: { includeDeleted?: boolean }) => {
      const effective = scopeOpts?.includeDeleted ? filter : { ...filter, deleted_at: null }
      return store.find((d) => matches(d, effective)) ?? null
    },
    restore: async (filter: Record<string, unknown>) => {
      const doc = store.find((d) => matches(d, filter))
      if (doc) doc.deleted_at = null
      return { matchedCount: doc ? 1 : 0 }
    },
  }
}

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return { ...actual, getCollection: vi.fn(async (base: string) => fakeCollection(base)) }
})

const { GET, POST } = await import('./route')

function getReq(qs = ''): Request {
  return new Request(`https://example.com/api/archive${qs}`)
}
function postReq(body: unknown): Request {
  return new Request('https://example.com/api/archive', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  stores.expenses = []
  stores.categories = []
})

describe('GET /api/archive', () => {
  it('lists only archived (soft-deleted) rows, with a computed label and purgesAt', async () => {
    stores.categories.push(
      { _id: new ObjectId(), name: 'Groceries', deleted_at: '2026-01-01T00:00:00.000Z' },
      { _id: new ObjectId(), name: 'Rent', deleted_at: null },
    )
    const res = await GET(getReq('?collection=categories'))
    const body = (await res.json()) as { items: Array<{ label: string; purgesAt: string }> }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].label).toBe('Groceries')
    expect(body.items[0].purgesAt).toBe('2026-01-08T00:00:00.000Z')
  })

  it('rejects an unknown collection', async () => {
    const res = await GET(getReq('?collection=nonsense'))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/archive (restore)', () => {
  it('restores an archived item by id', async () => {
    const id = new ObjectId()
    stores.categories.push({ _id: id, name: 'Groceries', deleted_at: '2026-01-01T00:00:00.000Z' })

    const res = await POST(postReq({ collection: 'categories', id: id.toString() }))
    expect(res.status).toBe(200)
    expect(stores.categories[0].deleted_at).toBeNull()
  })

  it('rejects restoring when a live item with the same name already exists', async () => {
    const id = new ObjectId()
    stores.categories.push(
      { _id: id, name: 'Groceries', deleted_at: '2026-01-01T00:00:00.000Z' },
      { _id: new ObjectId(), name: 'Groceries', deleted_at: null },
    )

    const res = await POST(postReq({ collection: 'categories', id: id.toString() }))
    expect(res.status).toBe(409)
  })

  it('404s when the id is not actually archived', async () => {
    const id = new ObjectId()
    stores.categories.push({ _id: id, name: 'Groceries', deleted_at: null })

    const res = await POST(postReq({ collection: 'categories', id: id.toString() }))
    expect(res.status).toBe(404)
  })
})
