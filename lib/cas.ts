/**
 * Retries a read-guard-write step that reports a lost race by returning
 * `'retry'` (e.g. `matchedCount === 0` on an update guarded by the value just
 * read). Money fields are stored as strings (CSV-era legacy), so an atomic
 * `$inc` isn't available — this is the substitute: `step` guards its write on
 * the exact value it read, and re-reads + retries when someone else won.
 */
export async function casRetry<T>(step: () => Promise<T | 'retry'>, maxAttempts = 3): Promise<T> {
  for (let i = 0; i < maxAttempts - 1; i++) {
    const outcome = await step()
    if (outcome !== 'retry') return outcome
  }
  const final = await step()
  if (final === 'retry') throw new Error('casRetry: exceeded max attempts — too much write contention')
  return final
}
