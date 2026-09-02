/**
 * Shared constants for the soft-delete/archive/GC feature (lib/scoped.ts's
 * `deleted_at` field). Collections a user can browse/restore from the Archive
 * screen — the account-level `users` collection has its own restore flow
 * (app/api/user/restore) since it isn't itself a `getCollection`-scoped view.
 */
export const ARCHIVABLE_COLLECTIONS = [
  'expenses',
  'budgets',
  'categories',
  'groups',
  'subscriptions',
  'holdings',
] as const

export type ArchivableCollection = (typeof ARCHIVABLE_COLLECTIONS)[number]

export function isArchivableCollection(value: string): value is ArchivableCollection {
  return (ARCHIVABLE_COLLECTIONS as readonly string[]).includes(value)
}

/** How long an archived (soft-deleted) row stays recoverable before the GC cron purges it. */
export const GRACE_DAYS = 7

/** When a row/account archived at `deletedAt` becomes eligible for real deletion. */
export function purgesAt(deletedAt: string): string {
  const d = new Date(deletedAt)
  d.setDate(d.getDate() + GRACE_DAYS)
  return d.toISOString()
}
