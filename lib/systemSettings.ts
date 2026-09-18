import { getDb } from './mongodb'
import { error } from './http'

export interface SystemSettings {
  /** Kill switch: every Gemini-backed feature answers 503 and the coach push falls back to its plain body. */
  aiDisabled: boolean
  /** Banner shown across the web app and exposed at GET /api/system/status for clients. */
  maintenance: { on: boolean; message: string }
  /** Latest store release advertised to Android clients on the More screen. Empty disables the prompt. */
  appUpdate: { android: { latestVersion: string; storeUrl: string } }
  /**
   * Subscription launch switches, flagged independently so each can be rolled
   * back on its own (see payment-subscriptions-plan.md, "Controlled launch").
   * `enforced` is the only one that can lock anyone out; it stays off until
   * the legacy-trial migration has run and purchase + export are proven.
   */
  billing: {
    /** Gate access on the entitlement. Off = resolve and report honestly, block nothing. */
    enforced: boolean
    /** Show purchase entry points in the clients. Independent of `enforced`. */
    purchaseEnabled: boolean
    /**
     * Who the two switches above apply to. `testers` = only users with
     * `billingTester: true` (scripts/grant-billing-tester.mjs); everyone else
     * behaves as if both were off. Lets the full trial/paywall flow be tested
     * against the production backend without touching real users. Absent
     * means `testers`, so turning a switch on can never reach real users by
     * accident — going live is a separate, deliberate change to `everyone`.
     */
    audience: 'testers' | 'everyone'
  }
}

const DEFAULTS: SystemSettings = {
  aiDisabled: false,
  maintenance: { on: false, message: '' },
  appUpdate: {
    android: {
      latestVersion: '',
      storeUrl: 'https://play.google.com/store/apps/details?id=com.sukrit04.envelope',
    },
  },
  billing: { enforced: false, purchaseEnabled: false, audience: 'testers' },
}
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
      appUpdate: {
        android: { ...DEFAULTS.appUpdate.android, ...doc?.appUpdate?.android },
      },
      billing: { ...DEFAULTS.billing, ...doc?.billing },
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
