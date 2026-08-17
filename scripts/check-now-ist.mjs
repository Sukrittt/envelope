import assert from 'node:assert/strict'

// Mirrors Web/lib/http.ts nowIST() — kept in sync manually since this is a plain
// Node script and can't import the TS module directly.
function nowIST(nowMs) {
  const iso = new Date(nowMs + 5.5 * 60 * 60 * 1000).toISOString()
  return { date: iso.slice(0, 10), timestamp: `${iso.slice(0, 19)}+05:30` }
}

// 2026-08-17T18:35:00Z -> IST is 5:30 ahead -> 2026-08-18T00:05:00+05:30 (rolls to next day)
assert.deepEqual(nowIST(Date.parse('2026-08-17T18:35:00.000Z')), {
  date: '2026-08-18',
  timestamp: '2026-08-18T00:05:00+05:30',
})

// 2026-08-17T04:00:00Z -> IST 09:30:00, same calendar day
assert.deepEqual(nowIST(Date.parse('2026-08-17T04:00:00.000Z')), {
  date: '2026-08-17',
  timestamp: '2026-08-17T09:30:00+05:30',
})

console.log('nowIST self-check passed')
