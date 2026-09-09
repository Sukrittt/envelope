import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePersistentState } from './usePersistentState'
import { useCollapsedGroups } from './useCollapsedGroups'
import { useRecentCategories } from './useRecentCategories'
import { useDismissedRolloverBanner } from './useDismissedRolloverBanner'
import { clearLocalPrefs, readPref, writePref } from '@/src/lib/localPref'

// Web-only layer: mobile's twins call SecureStore directly and have their own
// tests over there, so none of this coverage comes across with the port.

const parse = (raw: string) => JSON.parse(raw) as string[]
const serialize = (value: string[]) => JSON.stringify(value)

beforeEach(() => {
  window.localStorage.clear()
})

describe('usePersistentState', () => {
  it('falls back to the given value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    expect(result.current[0]).toEqual([])
  })

  it('reads a value written before mount', () => {
    writePref('mc-x', JSON.stringify(['a']))
    const { result } = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    expect(result.current[0]).toEqual(['a'])
  })

  it('persists a write and reflects it in the returned value', () => {
    const { result } = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    act(() => result.current[1](['b']))
    expect(result.current[0]).toEqual(['b'])
    expect(readPref('mc-x')).toBe(JSON.stringify(['b']))
  })

  it('supports an updater function', () => {
    writePref('mc-x', JSON.stringify(['a']))
    const { result } = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    act(() => result.current[1]((prev) => [...prev, 'b']))
    expect(result.current[0]).toEqual(['a', 'b'])
  })

  it('falls back rather than throwing on a corrupt stored value', () => {
    writePref('mc-x', 'not json')
    const { result } = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    expect(result.current[0]).toEqual([])
  })

  it('keeps two hooks on the same key in step', () => {
    const a = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    const b = renderHook(() => usePersistentState<string[]>('mc-x', [], parse, serialize))
    act(() => a.result.current[1](['shared']))
    expect(b.result.current[0]).toEqual(['shared'])
  })
})

describe('useCollapsedGroups', () => {
  it('namespaces by screen so two screens do not share a choice', () => {
    const home = renderHook(() => useCollapsedGroups('home'))
    act(() => home.result.current[1](new Set(['Essentials'])))
    const envelopes = renderHook(() => useCollapsedGroups('envelopes'))
    expect([...envelopes.result.current[0]]).toEqual([])
    expect([...home.result.current[0]]).toEqual(['Essentials'])
  })
})

describe('useRecentCategories', () => {
  it('records most-recent-first and persists', () => {
    const { result } = renderHook(() => useRecentCategories())
    act(() => result.current.record('Food'))
    act(() => result.current.record('Travel'))
    act(() => result.current.record('Food'))
    expect(result.current.recents).toEqual(['Food', 'Travel'])
    expect(readPref('mc-recent-categories')).toBe(JSON.stringify(['Food', 'Travel']))
  })
})

describe('useDismissedRolloverBanner', () => {
  it('starts null so callers do not flash the banner', () => {
    const { result } = renderHook(() => useDismissedRolloverBanner('2026-08'))
    expect(result.current[0]).toBeNull()
  })

  it('keys by month, so a new month starts undismissed', () => {
    const august = renderHook(() => useDismissedRolloverBanner('2026-08'))
    act(() => august.result.current[1](true))
    expect(august.result.current[0]).toBe(true)
    const september = renderHook(() => useDismissedRolloverBanner('2026-09'))
    expect(september.result.current[0]).toBeNull()
  })
})

describe('clearLocalPrefs', () => {
  it('drops account-scoped preferences but keeps the theme', () => {
    writePref('mc-collapsed-home', JSON.stringify(['Essentials']))
    writePref('mc-recent-categories', JSON.stringify(['Food']))
    window.localStorage.setItem('mc-theme', 'light')
    clearLocalPrefs()
    expect(readPref('mc-collapsed-home')).toBeNull()
    expect(readPref('mc-recent-categories')).toBeNull()
    expect(window.localStorage.getItem('mc-theme')).toBe('light')
  })
})
