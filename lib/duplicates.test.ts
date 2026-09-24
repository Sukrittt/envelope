import { describe, it, expect, vi, beforeEach } from 'vitest'

const runJev = vi.fn()
vi.mock('./ai/jev', () => ({ runJev: (...args: unknown[]) => runJev(...args) }))

const { duplicateCandidates, findDuplicateOf } = await import('./duplicates')
const caller = { userId: 'user_1', feature: 'duplicate' as const }

function exp(id: string, item: string, amount: string, time: string, payment_method = 'bank') {
  return { id, item, amount_inr: amount, timestamp: `2026-09-24T${time}`, payment_method }
}

beforeEach(() => vi.clearAllMocks())

describe('duplicateCandidates', () => {
  const added = exp('new', 'Swiggy dinner', '450', '20:10:00')

  it('keeps same-amount, same-method expenses within 30 minutes, closest first', () => {
    const others = [
      exp('a', 'swiggy', '450', '19:45:00'),
      exp('b', 'Zomato', '450', '20:05:00'),
    ]
    expect(duplicateCandidates(added, others).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('ignores a different amount, method, a far-apart time, itself, and unparseable timestamps', () => {
    const others = [
      exp('amount', 'Swiggy dinner', '451', '20:09:00'),
      exp('method', 'Swiggy dinner', '450', '20:09:00', 'credit_card'),
      exp('far', 'Swiggy dinner', '450', '19:30:00'),
      exp('new', 'Swiggy dinner', '450', '20:10:00'),
      { ...exp('bad', 'Swiggy dinner', '450', '20:10:00'), timestamp: 'nope' },
    ]
    expect(duplicateCandidates(added, others)).toEqual([])
  })

  it('treats "450" and "450.00" as the same amount', () => {
    expect(duplicateCandidates(added, [exp('a', 'x', '450.00', '20:00:00')])).toHaveLength(1)
  })

  it('matches across midnight', () => {
    const late = { ...exp('late', 'Uber', '300', '23:55:00') }
    const early = { ...exp('early', 'Uber', '300', '00:05:00'), timestamp: '2026-09-25T00:05:00' }
    expect(duplicateCandidates(early, [late])).toHaveLength(1)
  })
})

describe('findDuplicateOf', () => {
  it('returns null without calling Jev when nothing matches', async () => {
    await expect(findDuplicateOf(exp('new', 'Tea', '20', '10:00:00'), [], caller)).resolves.toBeNull()
    expect(runJev).not.toHaveBeenCalled()
  })

  it('flags an identical item name without calling Jev', async () => {
    const others = [exp('a', ' swiggy  DINNER ', '450', '20:00:00')]
    await expect(findDuplicateOf(exp('new', 'Swiggy dinner', '450', '20:10:00'), others, caller)).resolves.toBe('a')
    expect(runJev).not.toHaveBeenCalled()
  })

  it('asks Jev about each differently-named candidate and takes the most likely one above the bar', async () => {
    runJev.mockImplementation(async (state: { first: string }) => ({
      same: { type: 'boolean', probability: state.first === 'swiggy' ? 0.9 : 0.05 },
    }))
    const others = [exp('a', 'Zomato lunch', '450', '20:05:00'), exp('b', 'swiggy', '450', '19:50:00')]
    await expect(findDuplicateOf(exp('new', 'Swiggy dinner', '450', '20:10:00'), others, caller)).resolves.toBe('b')

    expect(runJev.mock.calls.map(([state]) => state)).toEqual([
      { first: 'Zomato lunch', second: 'Swiggy dinner' },
      { first: 'swiggy', second: 'Swiggy dinner' },
    ])
  })

  it('does not flag when Jev is unsure', async () => {
    runJev.mockResolvedValue({ same: { type: 'boolean', probability: 0.4 } })
    await expect(findDuplicateOf(exp('new', 'Coffee', '120', '09:10:00'), [exp('a', 'Latte', '120', '09:00:00')], caller)).resolves.toBeNull()
  })

  it('fails open when Jev errors', async () => {
    runJev.mockRejectedValue(new Error('gateway down'))
    await expect(findDuplicateOf(exp('new', 'Coffee', '120', '09:10:00'), [exp('a', 'Latte', '120', '09:00:00')], caller)).resolves.toBeNull()
  })
})
