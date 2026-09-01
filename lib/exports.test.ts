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
  return Object.entries(filter).every(([k, v]) => (k === '_id' && v instanceof ObjectId ? doc._id.equals(v) : doc[k] === v))
}

function fakeCollection(name: string) {
  const store = (stores[name] ??= [])
  return {
    collectionName: name,
    find: (filter: Record<string, unknown> = {}) => {
      const results = store.filter((d) => matches(d, filter))
      return {
        toArray: async () => results,
        map: (fn: (d: Doc) => unknown) => ({ toArray: async () => results.map(fn) }),
      }
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
      { _id: new ObjectId(), user_id: 'user_a', item: 'Coffee', amount_inr: '150', category: 'Food' } as Doc,
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
