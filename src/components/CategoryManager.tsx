import { useState, useEffect } from 'react'
import { getCategories, addCategory, updateCategory, deleteCategory } from '../services/api'
import type { Envelope } from '../types/expense'

interface Props {
  onClose: () => void
  onSaved: () => void
  envelopes: Envelope[] | null
}

export function CategoryManager({ onClose, onSaved, envelopes }: Props) {
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setCategories(cats)
        setLoading(false)
      })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [])

  function isOverspent(category: string): boolean {
    if (!envelopes) return false
    const env = envelopes.find(e => e.category === category)
    return env ? env.isOverspent : false
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setError('')
    try {
      await addCategory(newName.trim())
      setNewName('')
      const cats = await getCategories()
      setCategories(cats)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  async function handleSaveEdit(originalName: string) {
    if (!editName.trim()) return
    setError('')
    try {
      if (editName.trim() !== originalName) {
        await updateCategory(originalName, editName.trim())
      }
      setEditing(null)
      const cats = await getCategories()
      setCategories(cats)
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
      const cats = await getCategories()
      setCategories(cats)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="category-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="category-manager">
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
              {categories.map((cat) => {
                const overspent = isOverspent(cat)
                return (
                  <div key={cat} className={`category-manager-row ${overspent ? 'cm-row-overspent' : ''}`}>
                    {editing === cat ? (
                      <>
                        <input type="text" className="txn-entry-input" value={editName}
                          onChange={(e) => setEditName(e.target.value)} aria-label="Category name" />
                        <button type="button" className="action-button" onClick={() => handleSaveEdit(cat)}>Save</button>
                        <button type="button" className="action-button is-ghost" onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : deleteTarget === cat ? (
                      <div className="cm-delete-confirm">
                        <span className="muted">Remove "{cat}"? Past transactions are kept.</span>
                        <div className="cm-delete-actions">
                          <button type="button" className="action-button" onClick={() => handleDelete(cat)}>Remove</button>
                          <button type="button" className="action-button is-ghost" onClick={() => setDeleteTarget(null)}>Keep</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`cm-indicator ${overspent ? 'cm-indicator-overspent' : ''}`} />
                        <span className="category-manager-name">{cat}</span>
                        <button type="button" className="cm-icon-btn" title="Edit"
                          onClick={() => { setEditing(cat); setEditName(cat) }}>
                          ✏️
                        </button>
                        <button type="button" className="cm-icon-btn" title="Delete"
                          onClick={() => setDeleteTarget(cat)}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
              {categories.length === 0 && <p className="muted">No categories yet. Add one below.</p>}
            </div>
          )}
        </div>

        <div className="category-manager-add">
          <h4>Add Category</h4>
          <div className="category-manager-add-row">
            <input type="text" className="txn-entry-input" placeholder="Category name"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              aria-label="New category name" />
            <button type="button" className="action-button" onClick={handleAdd}>Add</button>
          </div>
        </div>
      </div>
    </div>
  )
}
