import { useCallback } from 'react'
import { usePersistentState } from './usePersistentState'

const KEY = 'mc-tour-done'
const EMPTY_SET: ReadonlySet<number> = new Set()

const parse = (raw: string) => new Set(JSON.parse(raw) as number[])
const serialize = (value: Set<number>) => JSON.stringify([...value])

/**
 * Which guided-tour chapters have been completed, remembered in this browser.
 * Drop-in for `useState<Set<number>>(new Set())` — same tuple, same setter.
 * Twin of Mobile/src/hooks/useTourProgress.ts.
 */
export function useTourProgress() {
  const [done, setStored] = usePersistentState<Set<number>>(KEY, EMPTY_SET as Set<number>, parse, serialize)
  const setDone = useCallback(
    (next: Set<number> | ((prev: Set<number>) => Set<number>)) => setStored(next),
    [setStored],
  )
  return [done, setDone] as const
}
