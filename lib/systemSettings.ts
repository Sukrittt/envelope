import { getDb } from './mongodb'
import { error } from './http'

export interface SystemSettings {
  /** Kill switch: every Gemini-backed feature answers 503 and the coach push falls back to its plain body. */
  aiDisabled: boolean
  /** Banner shown across the web app and exposed at GET /api/system/status for clients. */
  maintenance: { on: boolean; message: string }
}

const DEFAULTS: SystemSettings = { aiDisabled: false, maintenance: { on: false, message: '' } }
const SETTINGS_ID = 'global'
const CACHE_MS = 30_000

// ponytail: per-instance 30s cache — a toggle reaches every instance within 30s; add pub/sub only if that's too slow.
let cached: { value: SystemSettings; at: number } | null = null

/** Current settings. Fails open to defaults if the DB is unreachable, so a settings read never takes the app down. */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value
  try {
    const db = await getDb()
    const doc = await db.collection<Partial<SystemSettings> & { _id: string }>('system_settings').findOne({ _id: SETTINGS_ID })
    const value: SystemSettings = {
      aiDisabled: doc?.aiDisabled ?? DEFAULTS.aiDisabled,
      maintenance: { ...DEFAULTS.maintenance, ...doc?.maintenance },
    }
    cached = { value, at: Date.now() }
    return value
  } catch (err) {
    console.warn('[systemSettings] read failed, using defaults:', (err as Error).message)
    return DEFAULTS
  }
}

export async function saveSystemSettings(value: SystemSettings): Promise<void> {
  const db = await getDb()
  await db.collection<SystemSettings & { _id: string }>('system_settings').updateOne({ _id: SETTINGS_ID }, { $set: value }, { upsert: true })
  cached = { value, at: Date.now() }
}

export const AI_DISABLED_MESSAGE = 'AI features are temporarily unavailable. Please try again later.'

/** 503 when the AI kill switch is on, else null. Call at the top of every Gemini-backed route. */
export async function aiDisabledResponse() {
  return (await getSystemSettings()).aiDisabled ? error(AI_DISABLED_MESSAGE, 503) : null
}
