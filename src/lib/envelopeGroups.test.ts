import { describe, it, expect } from 'vitest'
import { groupCategories, orphanedBy, OTHER_LABEL } from './envelopeGroups'
import type { CategoryRow } from '@/src/types'

const cat = (name: string, group = ''): CategoryRow => ({ name, group })

describe('groupCategories', () => {
  it('keeps the groups in their stored order, not alphabetical', () => {
    const result = groupCategories(
      [cat('Rent', 'Home'), cat('Petrol', 'Travel')],
      ['Travel', 'Home'],
    )
    expect(result.map((g) => g.name)).toEqual(['Travel', 'Home'])
  })

  it('keeps a group with no categories, so it can still be filled', () => {
    const result = groupCategories([], ['Home'])
    expect(result).toEqual([{ name: 'Home', label: 'Home', items: [] }])
  })

  it('puts ungrouped categories last, labelled Other', () => {
    const result = groupCategories([cat('Odds'), cat('Rent', 'Home')], ['Home'])
    expect(result.at(-1)).toEqual({ name: '', label: OTHER_LABEL, items: [cat('Odds')] })
  })

  it('omits the Other bucket entirely when everything is grouped', () => {
    const result = groupCategories([cat('Rent', 'Home')], ['Home'])
    expect(result.map((g) => g.label)).toEqual(['Home'])
  })

  it('drops a category whose group no longer exists rather than inventing one', () => {
    // The screen re-homes these into Archived explicitly; they must not
    // silently reappear under Other in the meantime.
    const result = groupCategories([cat('Rent', 'Gone')], ['Home'])
    expect(result.flatMap((g) => g.items)).toEqual([])
  })
})

describe('orphanedBy', () => {
  it('finds the categories a group deletion would strand', () => {
    const categories = [cat('Rent', 'Home'), cat('Water', 'Home'), cat('Petrol', 'Travel')]
    expect(orphanedBy(categories, 'Home').map((c) => c.name)).toEqual(['Rent', 'Water'])
  })
})
