import { Type } from '@google/genai'
import { json, getCollection } from '@/lib/http'
import { generateJSON } from '@/lib/ai/gemini'
import { sendPushNotification } from '@/lib/push'

export const dynamic = 'force-dynamic'

const BATCH_LIMIT = 40
const HISTORY_DAYS = 90

interface Flag {
  item: string
  timestamp: string
  reason: string
  message: string
}

/** Recent (last ~HISTORY_DAYS) per-category amount stats, used as prompt context. */
function buildCategoryHistory(docs: Record<string, unknown>[]): Record<string, { min: number; max: number; avg: number; count: number }> {
  const byCategory: Record<string, number[]> = {}
  for (const d of docs) {
    const category = String(d.category ?? '')
    const amount = Number(d.amount_inr)
    if (!category || Number.isNaN(amount)) continue
    ;(byCategory[category] ??= []).push(amount)
  }
  const stats: Record<string, { min: number; max: number; avg: number; count: number }> = {}
  for (const [category, amounts] of Object.entries(byCategory)) {
    stats[category] = {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      avg: Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length),
      count: amounts.length,
    }
  }
  return stats
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null
  if (!expected || req.headers.get('authorization') !== expected) {
    return json({ error: 'unauthorized' }, { status: 401 })
  }

  // Internal maintenance job — always the real (non-demo) collections.
  const expensesColl = await getCollection('expenses', 'real')
  const subscriptionsColl = await getCollection('subscriptions', 'real')

  const batch = await expensesColl
    .find({ ai_scanned: { $ne: true } })
    .sort({ _id: -1 })
    .limit(BATCH_LIMIT)
    .toArray()

  if (batch.length === 0) {
    return json({ ok: true, scanned: 0, flagged: 0 })
  }

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const recentDocs = await expensesColl.find({ date: { $gte: since } }).toArray()
  const categoryHistory = buildCategoryHistory(recentDocs)
  const subscriptions = await subscriptionsColl.find({}).toArray()

  const batchIds = batch.map((d) => d._id)
  let flags: Flag[] = []
  let llmError: string | null = null

  try {
    const prompt = [
      'You are auditing a personal expense tracker for anomalies. Review this batch of new transactions',
      'against the category history and subscriptions context, and flag anything unusual. Flag when:',
      "(a) an amount is far outside its category's historical min/max/avg range,",
      '(b) it looks like a likely duplicate (same item + amount within a day of another transaction in the batch or recent history),',
      "(c) the category looks mismatched against the item/description text,",
      "(d) it looks subscription-like but its amount differs from the matching subscription's stored amount_inr.",
      'Only flag transactions that are genuinely suspicious — most transactions are normal and should not be flagged.',
      'For each flag, write a short, specific, single-sentence human-readable message a phone push notification will show verbatim.',
      '',
      `New transactions to review (batch): ${JSON.stringify(batch.map((d) => ({
        item: d.item,
        amount_inr: d.amount_inr,
        category: d.category,
        date: d.date,
        timestamp: d.timestamp,
        notes: d.notes,
      })))}`,
      '',
      `Per-category historical amount stats (last ${HISTORY_DAYS} days): ${JSON.stringify(categoryHistory)}`,
      '',
      `Known subscriptions (service, amount_inr): ${JSON.stringify(
        subscriptions.map((s) => ({ service: s.service, amount_inr: s.amount_inr })),
      )}`,
    ].join('\n')

    const result = await generateJSON<{ flags: Flag[] }>(prompt, {
      type: Type.OBJECT,
      properties: {
        flags: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              reason: { type: Type.STRING },
              message: { type: Type.STRING },
            },
            required: ['item', 'timestamp', 'reason', 'message'],
          },
        },
      },
      required: ['flags'],
    })
    flags = result.flags ?? []

    for (const flag of flags) {
      await sendPushNotification({
        title: 'Flagged transaction',
        body: flag.message,
        data: { date: flag.timestamp.slice(0, 10) },
      })
    }
  } catch (err) {
    llmError = err instanceof Error ? err.message : String(err)
    console.error('scan-transactions: LLM/push step failed', err)
  }

  // Always mark the batch as scanned, even on LLM/push failure — this is the
  // watermark that prevents re-scanning the same batch forever.
  await expensesColl.updateMany(
    { _id: { $in: batchIds } },
    { $set: { ai_scanned: true, ai_scanned_at: new Date().toISOString() } },
  )

  return json({ ok: true, scanned: batch.length, flagged: flags.length, ...(llmError ? { error: llmError } : {}) })
}
