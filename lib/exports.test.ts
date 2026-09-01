import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import * as XLSX from 'xlsx'

const put = vi.fn(async (pathname: string, _body: unknown, _opts: unknown) => ({ url: `https://blob.example/${pathname}` }))
vi.mock('@vercel/blob', () => ({ put: (...args: Parameters<typeof put>) => put(...args) }))

const sendPushNotification = vi.fn(async () => {})
vi.mock('@/lib/push', () => ({
  sendPushNotification: (...args: Parameters<typeof sendPushNotification>) => sendPushNotification(...args),
}))

type Doc = Record<string, unknown> & { _id: ObjectId }
const stores: Record<string, Doc[]> = { expenses: [], budgets: [], exports: [] }

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '_id' && v instanceof ObjectId) return doc._id.equals(v)
    if (v && typeof v === 'object' && !(v instanceof ObjectId)) {
      return Object.entries(v as Record<string, unknown>).every(([op, val]) => {
        if (op === '$gte') return (doc[k] as string) >= (val as string)
        if (op === '$lt') return (doc[k] as string) < (val as string)
        return true
      })
    }
    return doc[k] === v
  })
}

function fakeCollection(name: string) {
  const store = (stores[name] ??= [])
  return {
    collectionName: name,
    find: (filter: Record<string, unknown> = {}) => {
      let results = store.filter((d) => matches(d, filter))
      const cursor = {
        sort: (spec: Record<string, 1 | -1>) => {
          const [[field, dir]] = Object.entries(spec)
          results = [...results].sort((a, b) => ((a[field] as string) < (b[field] as string) ? -1 : (a[field] as string) > (b[field] as string) ? 1 : 0) * dir)
          return cursor
        },
        limit: (n: number) => {
          results = results.slice(0, n)
          return cursor
        },
        map: (fn: (d: Doc) => unknown) => {
          results = results.map(fn) as Doc[]
          return cursor
        },
        toArray: async () => results,
      }
      return cursor
    },
    updateOne: async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const doc = store.find((d) => matches(d, filter))
      if (doc) Object.assign(doc, update.$set)
      return { matchedCount: doc ? 1 : 0 }
    },
  }
}

vi.mock('@/lib/mongodb', () => ({
  getDb: vi.fn(async () => ({ collection: (name: string) => fakeCollection(name) })),
}))

const { buildAndStoreExport } = await import('./exports')

beforeEach(() => {
  stores.expenses = []
  stores.budgets = []
  stores.exports = []
  put.mockClear()
  sendPushNotification.mockClear()
})

describe('buildAndStoreExport', () => {
  it('builds a multi-tab workbook, uploads it, marks the doc ready, and notifies', async () => {
    const exportId = new ObjectId()
    stores.exports.push({ _id: exportId, user_id: 'user_a', status: 'pending', month: '2026-09', created_at: 'x' } as Doc)
    stores.expenses.push(
      { _id: new ObjectId(), user_id: 'user_a', item: 'Coffee', amount_inr: '150', category: 'Food', date: '2026-09-01' } as Doc,
    )
    stores.budgets.push({ _id: new ObjectId(), user_id: 'user_a', month: '2026-09', category: 'Food', assigned: '5000' } as Doc)

    await buildAndStoreExport('user_a', exportId.toString())

    expect(put).toHaveBeenCalledTimes(1)
    const [pathname, buffer, opts] = put.mock.calls[0]
    expect(pathname).toBe(`exports/user_a/${exportId.toString()}.xlsx`)
    expect(opts).toMatchObject({ access: 'public' })

    // Round-trip the uploaded buffer to confirm both collections became tabs.
    const wb = XLSX.read(buffer as Buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('expenses')
    expect(wb.SheetNames).toContain('budgets')
    const expenseRows = XLSX.utils.sheet_to_json(wb.Sheets.expenses)
    expect(expenseRows).toHaveLength(1)
    expect((expenseRows[0] as Record<string, unknown>).item).toBe('Coffee')

    const doc = stores.exports[0]
    expect(doc.status).toBe('ready')
    expect(doc.blob_url).toBe(`https://blob.example/exports/user_a/${exportId.toString()}.xlsx`)

    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_a', title: 'Your export is ready' }),
    )
  })

  it('fetches expenses month by month, covering every month between the earliest and latest', async () => {
    const exportId = new ObjectId()
    stores.exports.push({ _id: exportId, user_id: 'user_a', status: 'pending', month: '2026-09', created_at: 'x' } as Doc)
    stores.expenses.push(
      { _id: new ObjectId(), user_id: 'user_a', item: 'July', amount_inr: '1', category: 'Food', date: '2026-07-15' } as Doc,
      { _id: new ObjectId(), user_id: 'user_a', item: 'August', amount_inr: '2', category: 'Food', date: '2026-08-02' } as Doc,
      { _id: new ObjectId(), user_id: 'user_a', item: 'September', amount_inr: '3', category: 'Food', date: '2026-09-01' } as Doc,
    )

    await buildAndStoreExport('user_a', exportId.toString())

    const [, buffer] = put.mock.calls[0]
    const wb = XLSX.read(buffer as Buffer, { type: 'buffer' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.expenses) as Array<Record<string, unknown>>
    expect(rows.map((r) => r.item).sort()).toEqual(['August', 'July', 'September'])
  })

  it('marks the doc failed and sends a failure push when upload throws', async () => {
    const exportId = new ObjectId()
    stores.exports.push({ _id: exportId, user_id: 'user_a', status: 'pending', month: '2026-09', created_at: 'x' } as Doc)
    put.mockRejectedValueOnce(new Error('blob store unavailable'))

    await buildAndStoreExport('user_a', exportId.toString())

    const doc = stores.exports[0]
    expect(doc.status).toBe('failed')
    expect(doc.error).toBe('blob store unavailable')
    expect(sendPushNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_a', title: 'Export failed' }))
  })

  it('never throws even if the failure push itself fails', async () => {
    const exportId = new ObjectId()
    stores.exports.push({ _id: exportId, user_id: 'user_a', status: 'pending', month: '2026-09', created_at: 'x' } as Doc)
    put.mockRejectedValueOnce(new Error('blob store unavailable'))
    sendPushNotification.mockRejectedValueOnce(new Error('expo down'))

    await expect(buildAndStoreExport('user_a', exportId.toString())).resolves.toBeUndefined()
    expect(stores.exports[0].status).toBe('failed')
  })
})
