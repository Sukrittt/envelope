import { useCallback } from 'react'
import { usePersistentState } from './usePersistentState'
import { pushRecent } from '@/src/lib/recentCategories'
import { EMPTY } from '@/src/lib/constants'

const KEY = 'mc-recent-categories'

const parse = (raw: string) => JSON.parse(raw) as string[]
const serialize = (value: string[]) => JSON.stringify(value)

/**
 * Browser-local "most recently used" category list, shown above the grouped
 * list in the category picker. Twin of
 * Mobile/src/hooks/useRecentCategories.ts — a UI preference, not account data.
 */
export function useRecentCategories() {
  const [recents, setRecents] = usePersistentState<string[]>(KEY, EMPTY, parse, serialize)
  const record = useCallback((name: string) => setRecents((prev) => pushRecent(prev, name)), [setRecents])
  return { recents, record }
}
