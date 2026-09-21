import { getUserCurrency } from '@/lib/userCurrency'
import { ObjectId } from 'mongodb'
import { put, issueSignedToken, presignUrl } from '@vercel/blob'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/mongodb'
import { scoped, type ScopedCollection } from '@/lib/scoped'
import { getCollection, nowIST } from '@/lib/http'
import { sendPushNotification } from '@/lib/push'
import type { Auth } from '@/lib/access'
import { getAccess } from '@/lib/billing/service'
import { COLLECTIONS } from '@/lib/models'
import { exportColumns, readableSheetName } from '@/lib/exportFormat'

export const EXPORT_LIMIT = 3

/** 'YYYY-MM' for the current instant, IST — same convention as lib/wrapped.ts. */
export function currentMonthKey(): string {
  return nowIST().date.slice(0, 7)
}

function nextMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1)) // m is 1-indexed 'YYYY-MM', so this already rolls to next month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Expenses are the only collection that grows unbounded (months/years of
 * transactions), so fetch them one calendar month at a time instead of a
 * single `find({}).toArray()` that scans and buffers the whole history.
 * Every other collection (categories, budgets, holdings, ...) stays small
 * and bounded, so it keeps the plain single-query fetch.
 */
async function fetchExpensesByMonth(coll: ScopedCollection): Promise<Record<string, unknown>[]> {
  const [earliest] = await coll.find({}).sort({ date: 1 }).limit(1).toArray()
  if (!earliest) return []
  const [latest] = await coll.find({}).sort({ date: -1 }).limit(1).toArray()

  const docs: Record<string, unknown>[] = []
  let ym = String(earliest.date).slice(0, 7)
  const lastYm = String(latest.date).slice(0, 7)
  while (ym <= lastYm) {
    const nextYm = nextMonthKey(ym)
    const batch = await coll.find({ date: { $gte: `${ym}-01`, $lt: `${nextYm}-01` } }).toArray()
    docs.push(...batch)
    ym = nextYm
  }
  return docs
}

export async function countReadyExportsThisMonth(auth: Auth): Promise<number> {
  const coll = await getCollection('exports', auth)
  return coll.countDocuments({ status: 'ready', month: currentMonthKey() })
}

export interface ExportAllowance {
  usedThisMonth: number
  limit: number
  /** May another export be started right now? */
  allowed: boolean
  /** True only when the monthly cap is spent and this is the one post-expiry export. */
  exitExport: boolean
}

/** When continuous access ended: the later of the trial's end and any purchase's paid-through date. */
function accessEndedAt(access: { trialEndsAt: string | null; paidExpiresAt: string | null }): number {
  return Math.max(...[access.trialEndsAt, access.paidExpiresAt].map((v) => (v ? Date.parse(v) : 0)))
}

/** The most recent ready export's instant, or null — `created_at` is an offset-suffixed IST string, so parse it rather than comparing text. */
async function lastReadyExportAt(auth: Auth): Promise<number | null> {
  const coll = await getCollection('exports', auth)
  const [latest] = await coll.find({ status: 'ready' }).sort({ created_at: -1 }).limit(1).toArray()
  return latest ? Date.parse(String(latest.created_at)) : null
}

/**
 * Whether this account may start an export, and why.
 *
 * The monthly cap exists to bound workbook builds, not to hold anyone's data
 * hostage: an account whose access has ended is on its way out, and refusing
 * it the export traps someone who has already stopped paying us with no way
 * to take their data along until the 1st. So a lapsed account gets exactly
 * one export after access ends, regardless of what it spent that month.
 * Billing is only read on the capped path, so the ordinary export costs no
 * extra query.
 */
export async function exportAllowance(auth: Auth): Promise<ExportAllowance> {
  const usedThisMonth = await countReadyExportsThisMonth(auth)
  const base = { usedThisMonth, limit: EXPORT_LIMIT }
  if (usedThisMonth < EXPORT_LIMIT) return { ...base, allowed: true, exitExport: false }

  const access = await getAccess(auth.userId)
  if (access.mode !== 'expired') return { ...base, allowed: false, exitExport: false }

  const lastAt = await lastReadyExportAt(auth)
  const taken = lastAt !== null && lastAt > accessEndedAt(access)
  return { ...base, allowed: !taken, exitExport: !taken }
}

const EXPORT_DOWNLOAD_TTL_MS = 5 * 60 * 1000

/**
 * The store is private-only, so a ready export's blob isn't fetchable by a
 * plain URL — mints a short-lived signed GET URL (CDN-verified, no bearer
 * token needed to fetch it) scoped to this one export's pathname.
 */
export async function getExportDownloadUrl(userId: string, exportId: string): Promise<string> {
  const pathname = `exports/${userId}/${exportId}.xlsx`
  const signed = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil: Date.now() + EXPORT_DOWNLOAD_TTL_MS,
  })
  const { presignedUrl } = await presignUrl(signed, { operation: 'get', pathname, access: 'private' })
  return presignedUrl
}

/**
 * Builds the multi-tab workbook, uploads it to Blob storage, and notifies the
 * user. Runs inside `after()` — the kick-off POST has already responded, so
 * this must never throw: any failure is recorded on the doc and still
 * notifies, matching the never-throw pattern in lib/notifications/instant.ts.
 */
export async function buildAndStoreExport(userId: string, exportId: string): Promise<void> {
  const db = await getDb()
  const exportsColl = scoped(db.collection(COLLECTIONS.exports), userId)

  try {
    const wb = XLSX.utils.book_new()

    const columnsByCollection = exportColumns(await getUserCurrency(userId))
    for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
      const columns = columnsByCollection[key]
      if (!columns) continue

      const coll = scoped(db.collection(name), userId)
      const docs = key === 'expenses' ? await fetchExpensesByMonth(coll) : await coll.find({}).toArray()
      const headerRow = columns.map((c) => c.label)
      const dataRows = docs.map((d) => columns.map((c) => (c.format ? c.format(d[c.key]) : String(d[c.key] ?? ''))))
      const sheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      XLSX.utils.book_append_sheet(wb, sheet, readableSheetName(name).slice(0, 31)) // Excel tab-name length limit
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const blob = await put(`exports/${userId}/${exportId}.xlsx`, buffer, {
      access: 'private',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await exportsColl.updateOne(
      { _id: new ObjectId(exportId) },
      { $set: { status: 'ready', blob_url: blob.url, ready_at: nowIST().timestamp } },
    )
  } catch (err) {
    console.error('export: build failed for', userId, exportId, err)
    await exportsColl.updateOne(
      { _id: new ObjectId(exportId) },
      { $set: { status: 'failed', error: (err as Error).message } },
    )
    await sendPushNotification({
      userId,
      title: 'Export failed',
      body: 'Something went wrong building your export. Try again.',
      data: { route: '/account/data' },
    }).catch((pushErr) => console.error('export: failure push failed for', userId, exportId, pushErr))
    return
  }

  await sendPushNotification({
    userId,
    title: 'Your export is ready',
    body: 'Tap to download your data.',
    data: { route: '/account/data' },
  }).catch((pushErr) => console.error('export: ready push failed for', userId, exportId, pushErr))
}
