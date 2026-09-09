import { useCallback } from 'react'
import { usePersistentState } from './usePersistentState'

const KEY = 'expense-hide-amounts'

/**
 * Whether money is masked on screen. Web counterpart of Mobile's
 * PrivacyContext, and like it a device preference rather than account data:
 * hiding amounts is about who can see this screen, not about the account.
 *
 * The key predates the `mc-` preference prefix, so it is left as-is and
 * therefore survives clearLocalPrefs on sign-out. That is the right behaviour
 * for the same reason the theme survives: a shoulder-surfing setting belongs
 * to the room you are in, not the account you are signed into.
 */
export function useHideAmounts() {
  const [hidden, setStored] = usePersistentState<boolean>(
    KEY,
    false,
    (raw) => raw === 'true',
    (value) => String(value),
  )
  const setHidden = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => setStored(next),
    [setStored],
  )
  return [hidden, setHidden] as const
}
