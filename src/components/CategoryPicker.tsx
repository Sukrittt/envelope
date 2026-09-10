'use client'

import { useMemo, useState } from 'react'
import { useCategories } from '../hooks/useCategories'
import { useGroups } from '../hooks/useGroups'
import { useExpenses } from '../hooks/useExpenses'
import { useRecentCategories } from '../hooks/useRecentCategories'
import { deriveRecentsFromExpenses } from '../lib/recentCategories'
import { EMPTY } from '../lib/constants'
import type { CategoryRow } from '../types'

/** Below this many categories, search + recents shortcuts aren't worth the extra chrome. */
const RECENTS_MIN_CATEGORIES = 8
const MAX_RECENT_SHOWN = 6

interface Props {
  value: string
  onChange: (category: string) => void
}

/**
 * Grouped + searchable category picker with a "Recently used" rail, self-
 * contained (fetches categories/groups/expenses/recents itself) so any modal
 * can drop it in without threading data through props. Twin of Mobile's
 * CategoryPickerSheet, rendered inline instead of as its own sheet since
 * every caller here already sits inside one.
 */
export function CategoryPicker({ value, onChange }: Props) {
  const categoriesQ = useCategories()
  const groupsQ = useGroups()
  const expensesQ = useExpenses()
  const { recents, record } = useRecentCategories()
  const [search, setSearch] = useState('')

  const categories = categoriesQ.data ?? EMPTY
  const groups = groupsQ.data ?? EMPTY

  const groupedCategories = useMemo(() => {
    const byGroup = new Map<string, CategoryRow[]>()
    for (const c of categories) {
      const g = c.group || ''
      const arr = byGroup.get(g) ?? []
      arr.push(c)
      byGroup.set(g, arr)
    }
    const named = groups.map((g) => ({ name: g, items: byGroup.get(g) ?? [] }))
    const other = byGroup.get('') ?? []
    return other.length > 0 ? [...named, { name: '', items: other }] : named
  }, [categories, groups])

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return groupedCategories
    const q = search.trim().toLowerCase()
    return groupedCategories
      .map((g) => ({ ...g, items: g.items.filter((c) => c.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [groupedCategories, search])

  // The device's own MRU once it has one; expense history seeds it before
  // that (first load after this shipped, or a fresh browser).
  const recentNames = recents.length > 0 ? recents : deriveRecentsFromExpenses(expensesQ.data ?? EMPTY, categories)
  const groupByName = useMemo(() => new Map(categories.map((c) => [c.name, c.group])), [categories])
  const recentCategories = recentNames.filter((name) => groupByName.has(name)).slice(0, MAX_RECENT_SHOWN)
  const showRecents = !search.trim() && categories.length >= RECENTS_MIN_CATEGORIES && recentCategories.length > 0
  const hasResults = filteredCategories.some((g) => g.items.length > 0)

  function pick(category: string) {
    onChange(category)
    if (category) record(category)
  }

  return (
    <div className="category-picker">
      <input
        type="search"
        className="erd-search-input category-picker-search"
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="category-picker-list">
        {showRecents && (
          <div className="category-picker-group">
            <div className="category-picker-group-label">Recently used</div>
            <div className="erd-chip-row">
              {recentCategories.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`erd-chip ${value === name ? 'is-selected' : ''}`}
                  onClick={() => pick(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        {filteredCategories.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.name || 'other'} className="category-picker-group">
                <div className="category-picker-group-label">{group.name || 'Other'}</div>
                <div className="erd-chip-row">
                  {group.items.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`erd-chip ${value === c.name ? 'is-selected' : ''}`}
                      onClick={() => pick(c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ),
        )}
        {search.trim() && !hasResults && <p className="category-picker-empty">No categories found</p>}
      </div>
    </div>
  )
}
