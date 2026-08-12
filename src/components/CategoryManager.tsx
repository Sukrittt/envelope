import { useState, useEffect } from 'react'
import { getCategories, getGroups, addCategory, updateCategory, deleteCategory, moveCategory, addGroup, updateGroup, deleteGroup } from '../services/api'
import { Scrim, Sheet } from './MotionSheet'
import type { Envelope } from '../types/expense'
import type { CategoryRow } from '../services/api'

interface Props {
  onClose: () => void
  onSaved: () => void
  envelopes: Envelope[] | null
}

const UNGROUPED_LABEL = 'Other'

export function CategoryManager({ onClose, onSaved, envelopes }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingGroup, setAddingGroup] = useState(false)
  const [openGroupMenu, setOpenGroupMenu] = useState<string | null>(null)
  const [dragCategory, setDragCategory] = useState<string | null>(null)
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null)

  function groupIcon(name: string): string {
    const chars = Array.from(name)
    let end = 0
    while (end < chars.length && chars[end].codePointAt(0)! > 0x2fff) end++
    if (end > 0) return chars.slice(0, end).join('')
    return '◍'
  }

  async function load() {
    const [cats, grps] = await Promise.all([getCategories(), getGroups()])
    setCategories(cats)
    setGroups(grps)
  }

  useEffect(() => {
    Promise.all([getCategories(), getGroups()])
      .then(([cats, grps]) => {
        setCategories(cats)
        setGroups(grps)
        setLoading(false)
      })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!openGroupMenu) return
    function handleClick() {
      setOpenGroupMenu(null)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openGroupMenu])

  function isOverspent(category: string): boolean {
    if (!envelopes) return false
    const env = envelopes.find(e => e.category === category)
    return env ? env.isOverspent : false
  }

  async function handleAdd() {
    if (!newName.trim() || addingCategory) return
    setError('')
    setAddingCategory(true)
    try {
      await addCategory(newName.trim(), newGroup)
      setNewName('')
      setNewGroup('')
      await load()
      onSaved()
    } catch (err) {
      if (err instanceof Error && err.message.includes('409')) {
        setError(`Category "${newName.trim()}" already exists.`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add')
      }
      await load()
    } finally {
      setAddingCategory(false)
    }
  }

  async function handleSaveEdit(originalName: string) {
    if (!editName.trim()) return
    setError('')
    try {
      if (editName.trim() !== originalName) {
        await updateCategory(originalName, { newName: editName.trim() })
      }
      setEditing(null)
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(category: string) {
    setError('')
    try {
      await deleteCategory(category)
      setDeleteTarget(null)
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleSetGroup(category: string, group: string) {
    setError('')
    try {
      await updateCategory(category, { group })
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group')
    }
  }

  async function handleMoveCategory(category: string, toIndex: number) {
    setError('')
    try {
      await moveCategory(category, toIndex)
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder')
    }
  }

  function handleDrop(src: string, dst: string, items: CategoryRow[]) {
    if (!src || src === dst) return
    const srcIndex = items.findIndex((x) => x.name === src)
    const dstIndex = items.findIndex((x) => x.name === dst)
    if (srcIndex < 0 || dstIndex < 0) return
    const reordered = items.map((x) => x.name).filter((n) => n !== src)
    reordered.splice(dstIndex, 0, src)
    handleMoveCategory(src, reordered.indexOf(src))
  }

  async function handleAddGroup() {
    if (!newGroupName.trim() || addingGroup) return
    const name = newGroupName.trim()
    setError('')
    setAddingGroup(true)
    try {
      await addGroup(name)
      setNewGroupName('')
      setNewGroup(name)
      await load()
    } catch (err) {
      if (err instanceof Error && err.message.includes('409')) {
        setError(`Group "${name}" already exists.`)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to add group')
      }
      await load()
    } finally {
      setAddingGroup(false)
    }
  }

  async function handleSaveGroupEdit(originalName: string) {
    if (!editGroupName.trim()) return
    setError('')
    try {
      if (editGroupName.trim() !== originalName) {
        await updateGroup(originalName, editGroupName.trim())
      }
      setEditingGroup(null)
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename group')
    }
  }

  async function handleDeleteGroup(group: string) {
    setError('')
    try {
      await deleteGroup(group)
      setDeleteGroupTarget(null)
      await load()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group')
    }
  }

  const grouped = groups
    .map((g) => ({ label: g, items: categories.filter((c) => c.group === g) }))
  const ungrouped = categories.filter((c) => !c.group)
  if (ungrouped.length > 0) grouped.push({ label: UNGROUPED_LABEL, items: ungrouped })

  return (
    <Scrim className="category-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Sheet className="category-manager">
        <div className="category-manager-header">
          <h3>Manage Categories</h3>
          <button type="button" className="action-button is-ghost" onClick={onClose}>✕</button>
        </div>

        {error && <p className="txn-entry-error">{error}</p>}

        <div className="category-manager-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="category-manager-list">
              {grouped.map((group) => (
                <div key={group.label} className="cm-group">
                  {group.label === UNGROUPED_LABEL ? (
                    <div className="cm-group-header">
                      <span className="cm-group-name">Other</span>
                      <span className="cm-group-count">{group.items.length}</span>
                    </div>
                  ) : editingGroup === group.label ? (
                    <div className="cm-group-edit">
                      <input type="text" className="txn-entry-input" value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)} aria-label="Group name" />
                      <button type="button" className="action-button" onClick={() => handleSaveGroupEdit(group.label)}>Save</button>
                      <button type="button" className="action-button is-ghost" onClick={() => setEditingGroup(null)}>Cancel</button>
                    </div>
                  ) : deleteGroupTarget === group.label ? (
                    <div className="cm-delete-confirm">
                      <span className="muted">Delete "{group.label}"? Categories move to Other.</span>
                      <div className="cm-delete-actions">
                        <button type="button" className="action-button" onClick={() => handleDeleteGroup(group.label)}>Delete</button>
                        <button type="button" className="action-button is-ghost" onClick={() => setDeleteGroupTarget(null)}>Keep</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cm-group-header">
                      <span className="cm-group-name">{group.label}</span>
                      <span className="cm-group-count">{group.items.length}</span>
                      <span className="cm-group-actions">
                        <button type="button" className="cm-icon-btn" title="Rename group"
                          onClick={() => { setEditingGroup(group.label); setEditGroupName(group.label) }}>
                          ✏️
                        </button>
                        <button type="button" className="cm-icon-btn" title="Delete group"
                          onClick={() => setDeleteGroupTarget(group.label)}>
                          🗑️
                        </button>
                      </span>
                    </div>
                  )}
                  {group.items.map((cat) => {
                    const overspent = isOverspent(cat.name)
                    return (
                      <div
                        key={cat.name}
                        className={`category-manager-row ${overspent ? 'cm-row-overspent' : ''} ${dragCategory === cat.name ? 'cm-row-dragging' : ''} ${dragOverCategory === cat.name ? 'cm-row-drop-target' : ''}`}
                        onDragOver={(e) => { if (dragCategory) { e.preventDefault(); setDragOverCategory(cat.name) } }}
                        onDragLeave={() => setDragOverCategory((prev) => prev === cat.name ? null : prev)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOverCategory(null)
                          if (dragCategory) {
                            handleDrop(dragCategory, cat.name, group.items)
                            setDragCategory(null)
                          }
                        }}
                      >
                        {editing === cat.name ? (
                          <>
                            <input type="text" className="txn-entry-input" value={editName}
                              onChange={(e) => setEditName(e.target.value)} aria-label="Category name" />
                            <button type="button" className="action-button" onClick={() => handleSaveEdit(cat.name)}>Save</button>
                            <button type="button" className="action-button is-ghost" onClick={() => setEditing(null)}>Cancel</button>
                          </>
                        ) : deleteTarget === cat.name ? (
                          <div className="cm-delete-confirm">
                            <span className="muted">Remove "{cat.name}"? Past transactions are kept.</span>
                            <div className="cm-delete-actions">
                              <button type="button" className="action-button" onClick={() => handleDelete(cat.name)}>Remove</button>
                              <button type="button" className="action-button is-ghost" onClick={() => setDeleteTarget(null)}>Keep</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="cm-drag-handle" draggable title="Drag to reorder"
                              onDragStart={(e) => {
                                setDragCategory(cat.name)
                                setDragOverCategory(cat.name)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', cat.name)
                              }}
                              onDragEnd={() => { setDragCategory(null); setDragOverCategory(null) }}>
                              ⋮⋮
                            </span>
                            <span className={`cm-indicator ${overspent ? 'cm-indicator-overspent' : ''}`} />
                            <span className="category-manager-name">{cat.name}</span>
                            <div className="cm-group-btn-wrap">
                              <button
                                type="button"
                                className={`cm-group-btn ${openGroupMenu === cat.name ? 'is-open' : ''}`}
                                title="Move to group"
                                onClick={(e) => { e.stopPropagation(); setOpenGroupMenu(openGroupMenu === cat.name ? null : cat.name) }}
                              >
                                {groupIcon(cat.group)}<span className="cm-group-btn-caret">▾</span>
                              </button>
                              {openGroupMenu === cat.name && (
                                <div className="cm-group-menu" onClick={(e) => e.stopPropagation()}>
                                  <button type="button" className={`cm-group-option ${!cat.group ? 'is-selected' : ''}`}
                                    onClick={() => { setOpenGroupMenu(null); handleSetGroup(cat.name, '') }}>
                                    ◍ Other
                                  </button>
                                  {groups.map((g) => (
                                    <button key={g} type="button" className={`cm-group-option ${cat.group === g ? 'is-selected' : ''}`}
                                      onClick={() => { setOpenGroupMenu(null); handleSetGroup(cat.name, g) }}>
                                      {g}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button type="button" className="cm-icon-btn" title="Edit"
                              onClick={() => { setEditing(cat.name); setEditName(cat.name) }}>
                              ✏️
                            </button>
                            <button type="button" className="cm-icon-btn" title="Delete"
                              onClick={() => setDeleteTarget(cat.name)}>
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                  {group.items.length === 0 && (
                    <p className="cm-group-empty">No categories yet — add one with this group selected.</p>
                  )}
                </div>
              ))}
              {categories.length === 0 && <p className="muted">No categories yet. Add one below.</p>}
            </div>
          )}
        </div>

        <div className="cm-create-flow">
          <div className="category-manager-add">
            <h4>Add Group</h4>
            <div className="category-manager-add-row">
              <input type="text" className="txn-entry-input" placeholder="Group name"
                value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup() }}
                aria-label="New group name" disabled={addingGroup} />
              <button type="button" className="action-button" onClick={handleAddGroup} disabled={addingGroup}>Add</button>
            </div>
          </div>

          <div className="cm-create-connector" aria-hidden="true">
            <span>Categories belong to a group</span>
          </div>

          <div className="category-manager-add">
            <h4>Add Category</h4>
            <div className="category-manager-add-row">
              <input type="text" className="txn-entry-input" placeholder="Category name"
                value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                aria-label="New category name" disabled={addingCategory} />
              <select className="cm-group-select" value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)} aria-label="Group for new category" disabled={addingCategory}>
                <option value="">Other</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <button type="button" className="action-button" onClick={handleAdd} disabled={addingCategory}>Add</button>
            </div>
          </div>
        </div>
      </Sheet>
    </Scrim>
  )
}
