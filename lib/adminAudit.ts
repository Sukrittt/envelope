import { getDb } from './mongodb'

export const ADMIN_AUDIT = 'admin_audit'

export interface AdminAuditDoc {
  at: Date
  adminId: string
  action: string
  /** The user acted on, when the action targets one. */
  targetUserId: string | null
  detail: Record<string, unknown>
}

/** Records one admin write. Call after the action succeeds. */
export async function audit(adminId: string, action: string, targetUserId: string | null, detail: Record<string, unknown> = {}) {
  const db = await getDb()
  await db.collection<AdminAuditDoc>(ADMIN_AUDIT).insertOne({ at: new Date(), adminId, action, targetUserId, detail })
}
