import type { CategoryRow } from '@/src/types'

/** Label for categories that belong to no group. */
export const OTHER_LABEL = 'Other'
/** The one group that can't be deleted; orphaned categories land here. */
export const ARCHIVED_GROUP = 'Archived'

export interface CategoryGroup {
  /** The stored group name. Empty string means ungrouped. */
  name: string
  /** What to render: the group name, or OTHER_LABEL when ungrouped. */
  label: string
  items: CategoryRow[]
}

/**
 * Categories bucketed by group, in the groups' own stored order, with the
 * ungrouped ones last and only when there are any.
 *
 * Twin of the `groupedCategories` memo in Mobile's app/(tabs)/envelopes.tsx,
 * lifted out here because both the envelopes screen and home need it.
 */
export function groupCategories(categories: CategoryRow[], groups: string[]): CategoryGroup[] {
  const byGroup = new Map<string, CategoryRow[]>()
  for (const c of categories) {
    const key = c.group || ''
    const arr = byGroup.get(key) ?? []
    arr.push(c)
    byGroup.set(key, arr)
  }
  const named = groups.map((name) => ({ name, label: name, items: byGroup.get(name) ?? [] }))
  const ungrouped = byGroup.get('') ?? []
  return ungrouped.length > 0
    ? [...named, { name: '', label: OTHER_LABEL, items: ungrouped }]
    : named
}

/** Categories in `categories` whose group is not in `groups` — orphaned by a group deletion. */
export function orphanedBy(categories: CategoryRow[], deletedGroup: string): CategoryRow[] {
  return categories.filter((c) => c.group === deletedGroup)
}
