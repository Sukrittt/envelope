import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'

const storeBillScanImage = vi.fn(async () => {})
vi.mock('@/lib/billScan', () => ({
  storeBillScanImage: (...args: unknown[]) =>
    storeBillScanImage(...(args as Parameters<typeof storeBillScanImage>)),
}))

let auth = { userId: 'user_a', readOnly: false, sessionId: null as string | null }
vi.mock('@/lib/access', () => ({
  getAuth: vi.fn(async () => auth),
  readOnlyGuard: vi.fn((a: { readOnly: boolean }, method: string) =>
    a.readOnly && method !== 'GET' ? ({ status: 403 } as unknown) : null,
  ),
}))

const queuedAfter: Array<() => unknown> = []
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (fn: () => unknown) => queuedAfter.push(fn) }
})

type Doc = Record<string, unknown> & { _id: ObjectId }
const store: Doc[] = []

vi.mock('@/lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http')>()
  return {
    ...actual,
    getCollection: vi.fn(async () => ({
      insertOne: async (doc: Record<string, unknown>) => {
        const withId = { ...doc, _id: new ObjectId() } as Doc
        store.push(withId)
        return { insertedId: withId._id }
      },
    })),
  }
})

const { POST } = await import('./route')

const validBody = {
  image: 'aGVsbG8=',
  mimeType: 'image/png',
  merchant: 'Blinkit',
  category: 'Groceries',
  date: '2026-09-11',
  total: 900,
  my_share: 880,
  people_count: 2,
  expense_id: 'exp1',
  items: [
    { name: 'Milk', price: 60, qty: 1, divisor: 1 },
    { name: 'Pizza', price: 800, qty: 1, divisor: 1 },
  ],
}

function req(body: unknown): Request {
  return new Request('https://example.com/api/bills', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  store.length = 0
  queuedAfter.length = 0
  storeBillScanImage.mockClear()
  auth = { userId: 'user_a', readOnly: false, sessionId: null }
})

describe('POST /api/bills', () => {
  it('inserts a pending row and queues the image upload', async () => {
    const res = await POST(req(validBody))
    expect(res.status).toBe(202)
    const body = (await res.json()) as { id: string }

    expect(store).toHaveLength(1)
    expect(store[0]).toMatchObject({
      merchant: 'Blinkit',
      category: 'Groceries',
      total: '900',
      my_share: '880',
      expense_id: 'exp1',
      image_status: 'pending',
      image_url: null,
    })
    expect(store[0].items).toHaveLength(2)

    expect(queuedAfter).toHaveLength(1)
    await queuedAfter[0]()
    expect(storeBillScanImage).toHaveBeenCalledWith('user_a', body.id, validBody.image, 'image/png')
  })

  it('blocks the read-only demo user', async () => {
    auth = { userId: 'demo', readOnly: true, sessionId: null }
    const res = await POST(req(validBody))
    expect(res.status).toBe(403)
    expect(store).toHaveLength(0)
  })

  it('rejects a disallowed mimeType', async () => {
    const res = await POST(req({ ...validBody, mimeType: 'application/pdf' }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects an oversized image payload', async () => {
    const res = await POST(req({ ...validBody, image: 'a'.repeat(6_000_001) }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects a missing merchant', async () => {
    const res = await POST(req({ ...validBody, merchant: '' }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects an empty items array', async () => {
    const res = await POST(req({ ...validBody, items: [] }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects an item missing a name', async () => {
    const res = await POST(req({ ...validBody, items: [{ price: 10 }] }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects a negative total', async () => {
    const res = await POST(req({ ...validBody, total: -1 }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })

  it('rejects a missing expense_id', async () => {
    const res = await POST(req({ ...validBody, expense_id: '' }))
    expect(res.status).toBe(400)
    expect(store).toHaveLength(0)
  })
})
