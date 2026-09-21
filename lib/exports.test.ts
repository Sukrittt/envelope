import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import * as XLSX from 'xlsx'

const put = vi.fn(async (pathname: string, _body: unknown, _opts: unknown) => ({ url: `https://blob.example/${pathname}` }))
vi.mock('@vercel/blob', () => ({ put: (...args: Parameters<typeof put>) => put(...args) }))

type AccessStub = { mode: string; trialEndsAt: string | null; paidExpiresAt: string | null }
const getAccess = vi.fn(async (): Promise<AccessStub> => ({ mode: 'trial', trialEndsAt: null, paidExpiresAt: null }))
vi.mock('@/lib/billing/service', () => ({
  getAccess: (...args: unknown[]) => getAccess(...(args as Parameters<typeof getAccess>)),
}))

const sendPushNotification = vi.fn(async () => {})
vi.mock('@/lib/push', () => ({
  sendPushNotification: (...args: Parameters<typeof sendPushNotification>) => sendPushNotification(...args),
}))

type Doc = Record<string, unknown> & { _id: ObjectId }
const stores: Record<string, Doc[]> = { expenses: [], budgets: [], exports: [] }

function matches(doc: Doc, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '_id' && v instanceof ObjectId) return doc._id.equals(v)
    // `null` matches a missing field too (real Mongo semantics) — needed for
    // scoped()'s default `deleted_at: null` "live" filter on docs that
    // predate the field.
    if (v === null) return doc[k] == null
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
    findOne: async (filter: Record<string, unknown>) => store.find(d => matches(d, filter)) ?? null,
    countDocuments: async (filter: Record<string, unknown> = {}) => store.filter((d) => matches(d, filter)).length,
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

const { buildAndStoreExport, exportAllowance, currentMonthKey, EXPORT_LIMIT } = await import('./exports')

beforeEach(() => {
  stores.expenses = []
  stores.budgets = []
  stores.exports = []
  put.mockClear()
  sendPushNotification.mockClear()
  getAccess.mockClear().mockResolvedValue({ mode: 'trial', trialEndsAt: null, paidExpiresAt: null })
})

const auth = { userId: 'user_a', readOnly: false, sessionId: null }

/** A ready export for `user_a`, counted against this month's quota. */
function readyExport(created_at: string): Doc {
  return { _id: new ObjectId(), user_id: 'user_a', status: 'ready', month: currentMonthKey(), created_at } as Doc
}

describe('exportAllowance', () => {
  it('allows an export while under the monthly cap', async () => {
    stores.exports.push(readyExport('2026-09-01T10:00:00+05:30'))

    expect(await exportAllowance(auth)).toEqual({ usedThisMonth: 1, limit: EXPORT_LIMIT, allowed: true, exitExport: false })
    expect(getAccess).not.toHaveBeenCalled() // no billing read on the ordinary path
  })

  it('refuses at the cap while the account still has access', async () => {
    for (let i = 0; i < EXPORT_LIMIT; i++) stores.exports.push(readyExport(`2026-09-0${i + 1}T10:00:00+05:30`))

    expect(await exportAllowance(auth)).toEqual({ usedThisMonth: 3, limit: EXPORT_LIMIT, allowed: false, exitExport: false })
  })

  it('allows one export at the cap once access has ended', async () => {
    for (let i = 0; i < EXPORT_LIMIT; i++) stores.exports.push(readyExport(`2026-09-0${i + 1}T10:00:00+05:30`))
    getAccess.mockResolvedValue({ mode: 'expired', trialEndsAt: '2026-09-10T00:00:00.000Z', paidExpiresAt: null })

    expect(await exportAllowance(auth)).toEqual({ usedThisMonth: 3, limit: EXPORT_LIMIT, allowed: true, exitExport: true })
  })

  it('refuses a second exit export once one was taken after access ended', async () => {
    for (let i = 0; i < EXPORT_LIMIT; i++) stores.exports.push(readyExport(`2026-09-0${i + 1}T10:00:00+05:30`))
    stores.exports.push(readyExport('2026-09-11T10:00:00+05:30')) // taken after the trial ended
    getAccess.mockResolvedValue({ mode: 'expired', trialEndsAt: '2026-09-10T00:00:00.000Z', paidExpiresAt: null })

    expect(await exportAllowance(auth)).toMatchObject({ allowed: false, exitExport: false })
  })

  it('measures from the later of trial end and paid expiry', async () => {
    for (let i = 0; i < EXPORT_LIMIT; i++) stores.exports.push(readyExport(`2026-09-0${i + 1}T10:00:00+05:30`))
    // Exported after the trial ended, but the subscription ran on past it —
    // that export was taken while they still had access, so it isn't the exit one.
    stores.exports.push(readyExport('2026-09-11T10:00:00+05:30'))
    getAccess.mockResolvedValue({ mode: 'expired', trialEndsAt: '2026-09-10T00:00:00.000Z', paidExpiresAt: '2026-09-15T00:00:00.000Z' })

    expect(await exportAllowance(auth)).toMatchObject({ allowed: true, exitExport: true })
  })
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
    expect(opts).toMatchObject({ access: 'private' })

    // Round-trip the uploaded buffer to confirm both collections became tabs.
    const wb = XLSX.read(buffer as Buffer, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Expenses')
    expect(wb.SheetNames).toContain('Budgets')
    const expenseRows = XLSX.utils.sheet_to_json(wb.Sheets.Expenses) as Array<Record<string, unknown>>
    expect(expenseRows).toHaveLength(1)
    expect(expenseRows[0].Item).toBe('Coffee')
    expect(expenseRows[0]['Amount (INR)']).toBe('₹150')
    expect(expenseRows[0]).not.toHaveProperty('source')
    expect(expenseRows[0]).not.toHaveProperty('description')
    expect(expenseRows[0]).not.toHaveProperty('timestamp')

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
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Expenses) as Array<Record<string, unknown>>
    expect(rows.map((r) => r.Item).sort()).toEqual(['August', 'July', 'September'])
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
