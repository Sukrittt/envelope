import { ObjectId } from 'mongodb'
import { put } from '@vercel/blob'
import * as XLSX from 'xlsx'
import { getDb } from '@/lib/mongodb'
import { scoped } from '@/lib/scoped'
import { getCollection, nowIST } from '@/lib/http'
import { sendPushNotification } from '@/lib/push'
import type { Auth } from '@/lib/access'
import {
  COLLECTIONS,
  toRow,
  EXPENSE_HEADERS,
  BUDGET_HEADERS,
  CATEGORY_HEADERS,
  GROUP_HEADERS,
  SUBSCRIPTION_HEADERS,
  HOLDING_HEADERS,
  HOLDING_EVENT_HEADERS,
} from '@/lib/models'

export const EXPORT_LIMIT = 3

// Only the collections with a fixed CSV-era header shape become a tab.
// ponytail: skips categoryMapOverrides/chatSessions (no fixed columns, not
// user-facing budget data) — add a dynamic-header tab if users need those too.
const HEADERS: Partial<Record<keyof typeof COLLECTIONS, string[]>> = {
  expenses: EXPENSE_HEADERS,
  budgets: BUDGET_HEADERS,
  categories: CATEGORY_HEADERS,
  groups: GROUP_HEADERS,
  subscriptions: SUBSCRIPTION_HEADERS,
  holdings: HOLDING_HEADERS,
  holdingEvents: HOLDING_EVENT_HEADERS,
}

/** 'YYYY-MM' for the current instant, IST — same convention as lib/wrapped.ts. */
export function currentMonthKey(): string {
  return nowIST().date.slice(0, 7)
}

export async function countReadyExportsThisMonth(auth: Auth): Promise<number> {
  const coll = await getCollection('exports', auth)
  return coll.countDocuments({ status: 'ready', month: currentMonthKey() })
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

    for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
      const headers = HEADERS[key]
      if (!headers) continue

      const coll = scoped(db.collection(name), userId)
      const docs = await coll.find({}).toArray()
      const rows = docs.map((d) => toRow(headers, d))
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows.map((r) => headers.map((h) => r[h]))])
      XLSX.utils.book_append_sheet(wb, sheet, name.slice(0, 31)) // Excel tab-name length limit
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const blob = await put(`exports/${userId}/${exportId}.xlsx`, buffer, {
      access: 'public',
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
