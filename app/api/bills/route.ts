import { after } from 'next/server'
import { json, error, readBody, getCollection, nowIST } from '@/lib/http'
import { getAuth, readOnlyGuard } from '@/lib/access'
import { storeBillScanImage } from '@/lib/billScan'

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 50

/**
 * `GET /api/bills` — the scan history list. No image URL here (that's a
 * private-Blob signed URL, minted on demand by `GET /api/bills/[id]` only for
 * the one row a viewer opens, not eagerly for every row in the list).
 */
export async function GET(req: Request) {
  const auth = await getAuth(req)
  const coll = await getCollection('bill_scans', auth)
  const docs = await coll.find({}).sort({ created_at: -1 }).limit(LIST_LIMIT).toArray()

  return json({
    bills: docs.map((d) => ({
      id: String(d._id),
      merchant: String(d.merchant ?? ''),
      category: String(d.category ?? ''),
      date: String(d.date ?? ''),
      total: Number(d.total) || 0,
      my_share: Number(d.my_share) || 0,
      people_count: Number(d.people_count) || 1,
      item_count: Array.isArray(d.items) ? d.items.length : 0,
      image_status: String(d.image_status ?? 'pending'),
      created_at: String(d.created_at ?? ''),
    })),
  })
}

// Same wire-body cap as /api/expenses/scan — this is the same image, sent
// once more after the user confirms.
const MAX_IMAGE_LEN = 6_000_000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_ITEMS = 200
const MAX_MERCHANT_LEN = 200
const MAX_ITEM_NAME_LEN = 200

interface BillItemInput {
  name: string
  price: number
  qty: number
  divisor: number | null
}

function parseItems(raw: unknown): BillItemInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null
  const items: BillItemInput[] = []
  for (const it of raw as Record<string, unknown>[]) {
    const name = it && typeof it === 'object' ? it.name : undefined
    const price = it && typeof it === 'object' ? Number(it.price) : NaN
    if (typeof name !== 'string' || !name || name.length > MAX_ITEM_NAME_LEN || !Number.isFinite(price)) return null
    const qty = Number(it.qty)
    const divisor = it.divisor === null ? null : Number(it.divisor)
    items.push({
      name,
      price,
      qty: Number.isFinite(qty) ? qty : 1,
      divisor: divisor === null || Number.isFinite(divisor) ? divisor : 1,
    })
  }
  return items
}

/**
 * `POST /api/bills` — persists a confirmed bill scan: the merchant/category/
 * items/split the user reviewed, the expense it was logged as, and the
 * original photo. Called by the mobile app right after its `/api/expenses`
 * create succeeds (see `useScanBillController.handleConfirm`); best-effort —
 * a failure here doesn't undo or retry the expense itself.
 *
 * The row is inserted immediately with `image_status: 'pending'`; the actual
 * (potentially slow) Blob upload runs in `after()` via `storeBillScanImage`,
 * matching `lib/exports.ts`'s two-phase pending/ready shape.
 */
export async function POST(req: Request) {
  const auth = await getAuth(req)
  const guard = readOnlyGuard(auth, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const image = typeof body.image === 'string' ? body.image : ''
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : ''
  const merchant = typeof body.merchant === 'string' ? body.merchant.trim() : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const date = typeof body.date === 'string' ? body.date : ''
  const total = Number(body.total)
  const myShare = Number(body.my_share)
  const peopleCount = Number(body.people_count)
  const expenseId = typeof body.expense_id === 'string' ? body.expense_id.trim() : ''
  const items = parseItems(body.items)

  if (!image || image.length > MAX_IMAGE_LEN) return error('image required (max 4.5MB)')
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) return error('mimeType must be image/jpeg, image/png, or image/webp')
  if (!merchant || merchant.length > MAX_MERCHANT_LEN) return error('merchant required')
  if (!category) return error('category required')
  if (!date) return error('date required')
  if (!Number.isFinite(total) || total < 0) return error('total must be a non-negative number')
  if (!Number.isFinite(myShare) || myShare < 0) return error('my_share must be a non-negative number')
  if (!Number.isFinite(peopleCount) || peopleCount < 1) return error('people_count must be a positive number')
  if (!expenseId) return error('expense_id required')
  if (!items) return error('items must be a non-empty array of {name, price}')

  const coll = await getCollection('bill_scans', auth)
  const { insertedId } = await coll.insertOne({
    merchant,
    category,
    date,
    total: String(total),
    my_share: String(myShare),
    people_count: peopleCount,
    items,
    expense_id: expenseId,
    image_url: null,
    image_status: 'pending',
    created_at: nowIST().timestamp,
  })

  after(() => storeBillScanImage(auth.userId, insertedId.toString(), image, mimeType))

  return json({ id: insertedId.toString() }, { status: 202 })
}
