import { useCallback } from 'react'
import { usePersistentState } from './usePersistentState'

const EMPTY_SET: ReadonlySet<string> = new Set()

const parse = (raw: string) => new Set(JSON.parse(raw) as string[])
const serialize = (value: Set<string>) => JSON.stringify([...value])

/**
 * Which group headers are collapsed on a screen, remembered in this browser.
 * Drop-in for `useState<Set<string>>(new Set())` — same tuple, same setter.
 *
 * `screen` namespaces it, so home and envelopes keep their own choice rather
 * than fighting over one key.
 *
 * Twin of Mobile/src/hooks/useCollapsedGroups.ts. See usePersistentState for
 * why the hydrate-in-an-effect shape mobile uses isn't copied here, and
 * clearLocalPrefs in src/lib/localPref.ts for what replaces mobile's
 * clear-on-logout subscription.
 */
export function useCollapsedGroups(screen: string) {
  const [collapsed, setStored] = usePersistentState<Set<string>>(
    `mc-collapsed-${screen}`,
    EMPTY_SET as Set<string>,
    parse,
    serialize,
  )
  const setCollapsed = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => setStored(next),
    [setStored],
  )
  return [collapsed, setCollapsed] as const
}
