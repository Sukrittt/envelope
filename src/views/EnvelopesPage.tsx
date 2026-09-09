'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppearance } from '../../components/AppearanceProvider'
import { ExpenseSidebar } from '../components/ExpenseSidebar'
import { EnvelopeTabbar } from '../components/EnvelopeTabbar'
import { AlertThresholdPicker } from '../components/AlertThresholdPicker'
import {
  useCategories,
  useAddCategory,
  useUpdateCategory,
  useDeleteCategory,
  useMoveCategory,
} from '../hooks/useCategories'
import { useGroups, useAddGroup, useUpdateGroup, useDeleteGroup, useMoveGroup } from '../hooks/useGroups'
import { useCollapsedGroups } from '../hooks/useCollapsedGroups'
import { groupCategories, orphanedBy, ARCHIVED_GROUP, OTHER_LABEL } from '../lib/envelopeGroups'
import { splitEmoji } from '../lib/emoji'
import { DEFAULT_ALERT_PCTS } from '../lib/alerts'
import { EMPTY } from '../lib/constants'
import type { CategoryRow } from '../types'

/** A pending rename or creation, in whichever place the row sits. */
type Draft =
  | { kind: 'new-category'; group: string }
  | { kind: 'new-group' }
  | { kind: 'rename-category'; name: string; group: string }
  | { kind: 'rename-group'; name: string }

function sorted(pcts: number[]): number[] {
  return [...pcts].sort((a, b) => a - b)
}

function sameThresholds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function EnvelopesPage() {
  const { theme, setTheme } = useAppearance()

  const categoriesQuery = useCategories()
  const groupsQuery = useGroups()
  const addCategory = useAddCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const moveCategory = useMoveCategory()
  const addGroup = useAddGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const moveGroup = useMoveGroup()

  const categories: CategoryRow[] = categoriesQuery.data ?? EMPTY
  const groups: string[] = groupsQuery.data ?? EMPTY

  const [collapsed, setCollapsed] = useCollapsedGroups('envelopes')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftText, setDraftText] = useState('')
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [draftPcts, setDraftPcts] = useState<number[]>(DEFAULT_ALERT_PCTS)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ kind: 'group' | 'category'; name: string; group: string } | null>(null)

  const grouped = useMemo(() => groupCategories(categories, groups), [categories, groups])
  const allKeys = useMemo(() => grouped.map((g) => g.label), [grouped])
  const allCollapsed = allKeys.length > 0 && allKeys.every((k) => collapsed.has(k))

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function beginDraft(next: Draft, initial = '') {
    setError(null)
    setDraft(next)
    setDraftText(initial)
  }

  async function run(action: () => Promise<unknown>, whenBusy: string) {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      // Never the raw server text: match a case we have written, else a
      // generic line the reader can act on.
      const message = e instanceof Error ? e.message : ''
      setError(/already exists/i.test(message) ? `That ${whenBusy} already exists.` : 'That did not save. Try again.')
      return false
    }
  }

  async function commitDraft() {
    const name = draftText.trim()
    if (!draft || !name) return setDraft(null)
    let ok = false
    if (draft.kind === 'new-group') ok = await run(() => addGroup.mutateAsync(name), 'group')
    else if (draft.kind === 'new-category') ok = await run(() => addCategory.mutateAsync({ name, group: draft.group }), 'category')
    else if (draft.kind === 'rename-group')
      ok = await run(() => updateGroup.mutateAsync({ name: draft.name, newName: name }), 'group')
    else ok = await run(() => updateCategory.mutateAsync({ name: draft.name, updates: { newName: name } }), 'category')
    if (ok) setDraft(null)
  }

  async function saveThresholds() {
    if (!editing) return
    const current = editing.alertPcts ? sorted(editing.alertPcts) : DEFAULT_ALERT_PCTS
    const next = sorted(draftPcts)
    if (sameThresholds(current, next)) return setEditing(null)
    // null restores the server-side default set rather than pinning a copy of
    // it, so a later change to the defaults still reaches this category.
    const alertPcts = sameThresholds(next, DEFAULT_ALERT_PCTS) ? null : next
    const ok = await run(() => updateCategory.mutateAsync({ name: editing.name, updates: { alertPcts } }), 'category')
    if (ok) setEditing(null)
  }

  /**
   * Deleting a group would strand its categories, so they are re-homed into
   * Archived first — the same order Mobile uses, and the reason Archived can
   * never itself be deleted.
   */
  async function removeGroup(name: string) {
    if (name === ARCHIVED_GROUP) return
    const orphans = orphanedBy(categories, name)
    await run(async () => {
      if (orphans.length > 0) {
        if (!groups.includes(ARCHIVED_GROUP)) await addGroup.mutateAsync(ARCHIVED_GROUP)
        await Promise.all(
          orphans.map((c) => updateCategory.mutateAsync({ name: c.name, updates: { group: ARCHIVED_GROUP } })),
        )
      }
      await deleteGroup.mutateAsync(name)
    }, 'group')
  }

  function onDropGroup(targetIndex: number) {
    if (!dragging || dragging.kind !== 'group') return
    setDragging(null)
    void run(() => moveGroup.mutateAsync({ name: dragging.name, toIndex: targetIndex }), 'group')
  }

  function onDropCategory(targetIndex: number) {
    if (!dragging || dragging.kind !== 'category') return
    setDragging(null)
    void run(() => moveCategory.mutateAsync({ name: dragging.name, toIndex: targetIndex }), 'category')
  }

  const loading = categoriesQuery.isLoading || groupsQuery.isLoading

  return (
    <section className="expense-redesign">
      <button
        type="button"
        className="erd-theme-toggle"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <header className="erd-mobile-header">
        <div className="erd-mobile-greet">
          Envelopes <span>✉️</span>
        </div>
        <div className="erd-mobile-sub">
          <span>Every category, and the group it lives in</span>
        </div>
      </header>

      <div className="erd-main">
        <ExpenseSidebar />
        <div className="erd-content">
          <div className="erd-panel-head">
            <div>
              <div className="erd-panel-title">Envelopes</div>
              <div className="erd-panel-head-sub">
                {categories.length} {categories.length === 1 ? 'category' : 'categories'} in {groups.length}{' '}
                {groups.length === 1 ? 'group' : 'groups'}
              </div>
            </div>
            <div className="erd-panel-tools">
              <button
                type="button"
                className="erd-manage-btn"
                onClick={() => setCollapsed(allCollapsed ? new Set<string>() : new Set(allKeys))}
              >
                <ChevronsDownUp size={14} aria-hidden="true" />
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </button>
              <button type="button" className="erd-log-btn" onClick={() => beginDraft({ kind: 'new-group' })}>
                <Plus size={14} aria-hidden="true" />
                New group
              </button>
            </div>
          </div>

          {error && (
            <div className="erd-action-error" role="alert">
              {error}
            </div>
          )}

          {loading && <div className="erd-skeleton-block">Loading your envelopes…</div>}

          {!loading && grouped.length === 0 && (
            <p className="env-empty">No groups yet. Make one and start filling it.</p>
          )}

          <ul className="env-group-list" aria-label="Envelope groups">
            {grouped.map((group, groupIndex) => {
              const isCollapsed = collapsed.has(group.label)
              const { icon, text } = group.name ? splitEmoji(group.name) : { icon: '🗂️', text: OTHER_LABEL }
              return (
                <li
                  key={group.label}
                  className={`env-group${dragging?.kind === 'group' ? ' is-reordering' : ''}`}
                  onDragOver={(e) => dragging?.kind === 'group' && e.preventDefault()}
                  onDrop={() => onDropGroup(groupIndex)}
                >
                  <div className="env-group-head">
                    {group.name && (
                      <span
                        className="env-drag"
                        draggable
                        onDragStart={() => setDragging({ kind: 'group', name: group.name, group: group.name })}
                        onDragEnd={() => setDragging(null)}
                        aria-label={`Reorder ${text}`}
                      >
                        <GripVertical size={14} aria-hidden="true" />
                      </span>
                    )}
                    <button
                      type="button"
                      className="env-group-toggle"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronRight size={14} className={isCollapsed ? '' : 'is-open'} aria-hidden="true" />
                      <span className="env-group-icon" aria-hidden="true">
                        {icon}
                      </span>
                      {draft?.kind === 'rename-group' && draft.name === group.name ? (
                        <input
                          className="env-input"
                          autoFocus
                          value={draftText}
                          onChange={(e) => setDraftText(e.target.value)}
                          onBlur={commitDraft}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitDraft()
                            if (e.key === 'Escape') setDraft(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="env-group-name">{text}</span>
                      )}
                      <span className="env-group-count">{group.items.length}</span>
                    </button>
                    <div className="env-group-actions">
                      <button
                        type="button"
                        className="env-icon-btn"
                        onClick={() => beginDraft({ kind: 'new-category', group: group.name })}
                        aria-label={`Add a category to ${text}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                      {group.name && (
                        <button
                          type="button"
                          className="env-icon-btn"
                          onClick={() => beginDraft({ kind: 'rename-group', name: group.name }, group.name)}
                          aria-label={`Rename ${text}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      )}
                      {group.name && group.name !== ARCHIVED_GROUP && (
                        <button
                          type="button"
                          className="env-icon-btn env-icon-btn--danger"
                          onClick={() => void removeGroup(group.name)}
                          aria-label={`Delete ${text}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <ul className="env-cat-list">
                      {group.items.map((category, index) => {
                        const parts = splitEmoji(category.name)
                        const thresholds = category.alertPcts ? sorted(category.alertPcts) : DEFAULT_ALERT_PCTS
                        return (
                          <li
                            key={category.name}
                            className="env-cat"
                            onDragOver={(e) => dragging?.kind === 'category' && e.preventDefault()}
                            onDrop={() => onDropCategory(index)}
                          >
                            <span
                              className="env-drag"
                              draggable
                              onDragStart={() =>
                                setDragging({ kind: 'category', name: category.name, group: group.name })
                              }
                              onDragEnd={() => setDragging(null)}
                              aria-label={`Reorder ${parts.text}`}
                            >
                              <GripVertical size={14} aria-hidden="true" />
                            </span>
                            <span className="env-cat-icon" aria-hidden="true">
                              {parts.icon || '•'}
                            </span>
                            {draft?.kind === 'rename-category' && draft.name === category.name ? (
                              <input
                                className="env-input"
                                autoFocus
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                onBlur={commitDraft}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void commitDraft()
                                  if (e.key === 'Escape') setDraft(null)
                                }}
                              />
                            ) : (
                              <span className="env-cat-name">{parts.text}</span>
                            )}
                            <button
                              type="button"
                              className="env-cat-alerts"
                              onClick={() => {
                                setEditing(category)
                                setDraftPcts(thresholds)
                              }}
                              title="Alert thresholds"
                            >
                              {thresholds.map((p) => `${p}%`).join(' · ')}
                            </button>
                            <div className="env-cat-actions">
                              <button
                                type="button"
                                className="env-icon-btn"
                                onClick={() =>
                                  beginDraft(
                                    { kind: 'rename-category', name: category.name, group: group.name },
                                    category.name,
                                  )
                                }
                                aria-label={`Rename ${parts.text}`}
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="env-icon-btn env-icon-btn--danger"
                                onClick={() => void run(() => deleteCategory.mutateAsync(category.name), 'category')}
                                aria-label={`Delete ${parts.text}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        )
                      })}

                      {draft?.kind === 'new-category' && draft.group === group.name && (
                        <li className="env-cat env-cat--draft">
                          <span className="env-cat-icon" aria-hidden="true">
                            •
                          </span>
                          <input
                            className="env-input"
                            autoFocus
                            placeholder="Category name"
                            value={draftText}
                            onChange={(e) => setDraftText(e.target.value)}
                            onBlur={commitDraft}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitDraft()
                              if (e.key === 'Escape') setDraft(null)
                            }}
                          />
                        </li>
                      )}

                      {group.items.length === 0 && draft?.kind !== 'new-category' && (
                        <li className="env-cat env-cat--empty">Nothing in here yet.</li>
                      )}
                    </ul>
                  )}
                </li>
              )
            })}

            {draft?.kind === 'new-group' && (
              <li className="env-group env-group--draft">
                <div className="env-group-head">
                  <span className="env-group-icon" aria-hidden="true">
                    🗂️
                  </span>
                  <input
                    className="env-input"
                    autoFocus
                    placeholder="Group name"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitDraft()
                      if (e.key === 'Escape') setDraft(null)
                    }}
                  />
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      {editing && (
        <AlertThresholdPicker
          categoryName={splitEmoji(editing.name).text}
          value={draftPcts}
          onChange={setDraftPcts}
          onClose={() => setEditing(null)}
          onSave={() => void saveThresholds()}
        />
      )}

      <EnvelopeTabbar />
    </section>
  )
}
