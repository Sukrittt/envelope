import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { readPref, subscribePrefs, writePref } from '@/src/lib/localPref'

/**
 * `useState`, backed by a browser-local preference. The shared base for the
 * preference hooks whose mobile twins call SecureStore directly.
 *
 * Mobile hydrates in an effect because SecureStore is async. Web can't copy
 * that shape: reading localStorage during render desyncs server and client
 * markup, and setting state from an effect to work around it is what
 * `react-hooks/set-state-in-effect` exists to catch. `useSyncExternalStore` is
 * the primitive for exactly this — localStorage is an external store — and it
 * takes a separate server snapshot, so hydration is correct without an effect.
 *
 * `getSnapshot` returns the raw string, which is referentially stable across
 * calls; parsing happens in a `useMemo` downstream. Returning a freshly parsed
 * object from `getSnapshot` would loop forever.
 */
export function usePersistentState<T>(
  key: string,
  serverValue: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(
    subscribePrefs,
    () => readPref(key),
    // Nothing is stored on the server, and this is also the value React
    // hydrates with before swapping in the real one.
    () => null,
  )

  const value = useMemo(() => {
    if (raw === null) return serverValue
    try {
      return parse(raw)
    } catch {
      // Corrupt stored value — fall back rather than throwing.
      return serverValue
    }
    // `parse`/`serverValue` are stable per call site in practice; keying on the
    // raw string is what decides when this recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, key])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      writePref(key, serialize(resolved))
    },
    [key, value, serialize],
  )

  return [value, set] as const
}
