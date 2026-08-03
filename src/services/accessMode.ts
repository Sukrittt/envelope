import { useEffect, useState } from 'react'

export type AccessMode = 'real' | 'guest'

const STORAGE_KEY = 'mc-access'
const SESSION_MS = 30 * 24 * 60 * 60 * 1000 // ~30 days

let mode: AccessMode = 'guest'
const subs = new Set<(m: AccessMode) => void>()
const logoutSubs = new Set<() => void>()

interface StoredAccess {
  mode: AccessMode
  expiresAt: number
}

export const accessMode = {
  get: () => mode,
  set(next: AccessMode) {
    if (mode === next) return
    mode = next
    for (const fn of subs) fn(mode)
  },
  subscribe(fn: (m: AccessMode) => void): () => void {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  subscribeLogout(fn: () => void): () => void {
    logoutSubs.add(fn)
    return () => logoutSubs.delete(fn)
  },
}

export function isGuest(): boolean {
  return mode === 'guest'
}

/** Persist the chosen access mode so it survives reloads for up to 30 days. */
export function persistAccess(next: AccessMode): void {
  mode = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: next, expiresAt: Date.now() + SESSION_MS }))
  } catch {
    // Storage unavailable — the session just won't survive reloads.
  }
  for (const fn of subs) fn(mode)
}

/** Restore a previously persisted, still-valid access mode, or null when expired. */
export function readPersistedAccess(): AccessMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredAccess
    if (parsed?.mode !== 'real' && parsed?.mode !== 'guest') return null
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed.mode
  } catch {
    return null
  }
}

/** Log out: drop any persisted session, fall back to guest, and re-lock the gate. */
export function clearAccess(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  mode = 'guest'
  for (const fn of subs) fn(mode)
  for (const fn of logoutSubs) fn()
}

/** React hook that re-renders the consumer whenever the access mode changes. */
export function useAccessMode(): AccessMode {
  const [current, setCurrent] = useState<AccessMode>(accessMode.get)
  useEffect(() => accessMode.subscribe(setCurrent), [])
  return current
}
