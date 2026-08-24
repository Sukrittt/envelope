import { describe, it, expect, vi } from 'vitest'
import { getCachedCategoryMap, invalidateCategoryMap, buildCategoryMap } from './categoryMap'
import type { ScopedCollection } from './scoped'

function fakeExpensesCollection(rows: Array<{ item: string; category: string }>) {
  return {
    find: vi.fn(() => ({ toArray: async () => rows })),
  } as unknown as ScopedCollection
}

describe('getCachedCategoryMap / invalidateCategoryMap (C9)', () => {
  it('builds the map once and reuses it on a second call with the same userId', async () => {
    const userId = `user_${Math.random()}`
    const coll = fakeExpensesCollection([{ item: 'Swiggy dinner', category: 'Food' }])

    const first = await getCachedCategoryMap(userId, coll)
    const second = await getCachedCategoryMap(userId, coll)

    expect(coll.find).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('rebuilds after invalidateCategoryMap — the bug this fixes: a stale cache never refreshing', async () => {
    const userId = `user_${Math.random()}`
    const coll = fakeExpensesCollection([{ item: 'Swiggy dinner', category: 'Food' }])

    await getCachedCategoryMap(userId, coll)
    invalidateCategoryMap(userId)
    await getCachedCategoryMap(userId, coll)

    expect(coll.find).toHaveBeenCalledTimes(2)
  })

  it('keeps different users independent', async () => {
    const collA = fakeExpensesCollection([{ item: 'A', category: 'Food' }])
    const collB = fakeExpensesCollection([{ item: 'B', category: 'Rent' }])

    await getCachedCategoryMap('user_a_isolated', collA)
    await getCachedCategoryMap('user_b_isolated', collB)

    expect(collA.find).toHaveBeenCalledTimes(1)
    expect(collB.find).toHaveBeenCalledTimes(1)
  })
})

describe('buildCategoryMap', () => {
  it('picks the majority category per word, and lets overrides win on conflicts', async () => {
    const coll = fakeExpensesCollection([
      { item: 'swiggy dinner', category: 'Food' },
      { item: 'swiggy lunch', category: 'Food' },
      { item: 'swiggy instamart', category: 'Groceries' },
    ])
    const overrides = {
      find: vi.fn(() => ({ toArray: async () => [{ word: 'instamart', category: 'Groceries' }] })),
    } as unknown as ScopedCollection

    const map = await buildCategoryMap(coll, overrides)
    expect(map.words.swiggy).toBe('Food')
    expect(map.words.instamart).toBe('Groceries')
  })
})
