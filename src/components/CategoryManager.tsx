import { useState, useEffect } from 'react'
import { getBudgets, addBudget, updateBudget, deleteBudget, type BudgetRow } from '../services/api'
import type { Envelope } from '../types/expense'

interface Props {
  currentMonth: string
  onClose: () => void
  onSaved: () => void
  envelopes: Envelope[] | null
}

export function CategoryManager({ currentMonth, onClose, onSaved, envelopes }: Props) {
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    getBudgets()
      .then((rows) => {
        setBudgets(rows.filter(r => r.month === currentMonth && r.category !== '__income__'))
        setLoading(false)
      })
      .catch((err) => { setError(err.message); setLoading(false) })
  }, [currentMonth])

  function isOverspent(category: string): boolean {
    if (!envelopes) return false
    const env = envelopes.find(e => e.category === category)
    return env ? env.isOverspent : false
  }

  async function handleAdd() {
    if (!newName.trim() || !newAmount.trim()) return
    const amt = parseFloat(newAmount)
    if (Number.isNaN(amt)) return
    setError('')
    try {
      await addBudget({ month: currentMonth, category: newName.trim(), assigned: String(amt) })
      setNewName('')
      setNewAmount('')
      const rows = await getBudgets()
      setBudgets(rows.filter(r => r.month === currentMonth && r.category !== '__income__'))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  async function handleSaveEdit(originalName: string) {
    if (!editName.trim() || !editAmount.trim()) return
    const amt = parseFloat(editAmount)
    if (Number.isNaN(amt)) return
    setError('')
    try {
      await updateBudget(currentMonth, originalName, {
        category: editName.trim() !== originalName ? editName.trim() : undefined,
        assigned: String(amt),
      })
      setEditing(null)
      const rows = await getBudgets()
      setBudgets(rows.filter(r => r.month === currentMonth && r.category !== '__income__'))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(category: string) {
    setError('')
    try {
      await deleteBudget(currentMonth, category)
      setDeleteTarget(null)
      const rows = await getBudgets()
      setBudgets(rows.filter(r => r.month === currentMonth && r.category !== '__income__'))
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
              {budgets.map((b) => {
                const overspent = isOverspent(b.category)
                return (
                  <div key={b.category} className={`category-manager-row ${overspent ? 'cm-row-overspent' : ''}`}>
                    {editing === b.category ? (
                      <>
                        <input type="text" className="txn-entry-input" value={editName}
                          onChange={(e) => setEditName(e.target.value)} aria-label="Category name" />
                        <input type="number" step="any" className="txn-entry-input txn-entry-amount" value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)} aria-label="Budget amount" />
                        <button type="button" className="action-button" onClick={() => handleSaveEdit(b.category)}>Save</button>
                        <button type="button" className="action-button is-ghost" onClick={() => setEditing(null)}>Cancel</button>
                      </>
                    ) : deleteTarget === b.category ? (
                      <div className="cm-delete-confirm">
                        <span className="muted">Remove "{b.category}"? Past transactions are kept.</span>
                        <div className="cm-delete-actions">
                          <button type="button" className="action-button" onClick={() => handleDelete(b.category)}>Remove</button>
                          <button type="button" className="action-button is-ghost" onClick={() => setDeleteTarget(null)}>Keep</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`cm-indicator ${overspent ? 'cm-indicator-overspent' : ''}`} />
                        <span className="category-manager-name">{b.category}</span>
                        <span className="category-manager-amount">₹{Math.round(parseFloat(b.assigned) || 0).toLocaleString('en-IN')}</span>
                        <button type="button" className="cm-icon-btn" title="Edit"
                          onClick={() => { setEditing(b.category); setEditName(b.category); setEditAmount(b.assigned) }}>
                          ✏️
                        </button>
                        <button type="button" className="cm-icon-btn" title="Delete"
                          onClick={() => setDeleteTarget(b.category)}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
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
            <input type="number" step="any" className="txn-entry-input txn-entry-amount" placeholder="Monthly budget"
              value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              aria-label="Monthly budget amount" />
            <button type="button" className="action-button" onClick={handleAdd}>Add</button>
          </div>
        </div>
      </div>
    </div>
  )
}
