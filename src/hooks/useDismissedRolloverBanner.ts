import { useCallback } from 'react'
import { usePersistentState } from './usePersistentState'

const parse = (raw: string) => raw === '1'
const serialize = (value: boolean) => (value ? '1' : '0')

/**
 * Whether the "left over from last month" banner has been dismissed,
 * remembered in this browser. Drop-in for `useState(false)` — same tuple, same
 * setter. Keyed by the month the banner is about, so next month's banner
 * starts undismissed on its own without any reset logic here.
 *
 * Twin of Mobile/src/hooks/useDismissedRolloverBanner.ts, which starts `null`
 * (unknown) so callers don't flash the banner before the stored value loads.
 * Here that `null` falls out of the server snapshot for free: it is what both
 * the server render and React's hydration pass see, and the stored answer
 * replaces it immediately afterwards. Mobile's reset-during-render guard for a
 * changed month has no counterpart — the key is the store's identity, so a new
 * month reads its own value rather than carrying the last one over.
 */
export function useDismissedRolloverBanner(monthKey: string) {
  const [dismissed, setStored] = usePersistentState<boolean | null>(
    `mc-rollover-dismissed-${monthKey}`,
    null,
    parse,
    (value) => serialize(value ?? false),
  )
  const setDismissed = useCallback(
    (next: boolean | null | ((prev: boolean | null) => boolean | null)) => setStored(next),
    [setStored],
  )
  return [dismissed, setDismissed] as const
}
