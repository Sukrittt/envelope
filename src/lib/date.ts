const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** IST calendar date ("YYYY-MM-DD") for a given instant. Mirrors Web's lib/http.ts::nowIST() —
 *  `new Date().toISOString()` alone yields the UTC calendar date, which is a day behind IST
 *  between 00:00–05:29 IST. */
export function toISTDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Today's IST calendar date. */
export function todayIST(): string {
  return toISTDateString()
}

/**
 * IST date + full timestamp for right now, minted on the device. Mirrors
 * Web's `lib/http.ts::nowIST()` exactly (same slice points, same `+05:30`
 * suffix) so a client-minted timestamp is indistinguishable from a
 * server-minted one. Used so an offline expense is stamped with the day it
 * was actually logged, not the day the queue happens to flush.
 */
// Keep in sync with Web/lib/http.ts.
export function nowIST(): { date: string; timestamp: string } {
  const iso = new Date(Date.now() + IST_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), timestamp: `${iso.slice(0, 19)}+05:30` }
}
