import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Envelope } from '../types/expense'

interface Props {
  envelopes: Envelope[]
  hideAmounts: boolean
  readyToAssign: number
  searchQuery: string
  sortKey: 'overspent-first' | 'alphabetical' | 'by-assigned'
  onMoveMoney: (category: string) => void
  onAssignFromRTA: (category: string, amount: number) => void
  onPayCreditCard?: () => void
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export function EnvelopeGrid({ envelopes, hideAmounts, readyToAssign, searchQuery, sortKey, onMoveMoney, onAssignFromRTA, onPayCreditCard }: Props) {
  const navigate = useNavigate()
  const [menuCategory, setMenuCategory] = useState<string | null>(null)
  const [menuAssignCategory, setMenuAssignCategory] = useState<string | null>(null)
  const [menuAssignValue, setMenuAssignValue] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!menuCategory) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuCategory(null)
        setMenuAssignCategory(null)
        setMenuAssignValue('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuCategory])

  useEffect(() => {
    if (menuAssignCategory && inputRef.current) {
      inputRef.current.focus()
    }
  }, [menuAssignCategory])

  function handleAssignKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const amount = Number(menuAssignValue)
      if (amount > 0 && amount <= readyToAssign && menuAssignCategory) {
        onAssignFromRTA(menuAssignCategory, amount)
      }
      setMenuCategory(null)
      setMenuAssignCategory(null)
      setMenuAssignValue('')
    }
    if (e.key === 'Escape') {
      setMenuAssignCategory(null)
      setMenuAssignValue('')
    }
  }

  if (!envelopes.length) {
    return (
      <div className="envelope-grid-empty">
        <p>No envelopes yet. Set up budgets in the budgets CSV to get started.</p>
      </div>
    )
  }

  return (
    <table className="env-table">
      <thead>
        <tr className="env-table-header">
          <th className="env-th env-th-cat">Category</th>
          <th className="env-th env-th-num">Assigned</th>
          <th className="env-th env-th-num">Spent</th>
          <th className="env-th env-th-num">Available</th>
          <th className="env-th env-th-action" />
        </tr>
      </thead>
      <tbody>
        {envelopes
          .filter((e) => e.category.toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a, b) => {
            if (sortKey === 'overspent-first') {
              if (a.isOverspent !== b.isOverspent) return a.isOverspent ? -1 : 1
              return a.available - b.available
            }
            if (sortKey === 'alphabetical') return a.category.localeCompare(b.category)
            return b.assigned - a.assigned
          })
          .map((e) => {
          const isCC = e.isCreditCardPayment
          const isOverspent = e.isOverspent
          const hasBalance = e.available > 0
          const pct = Math.min(100, e.spentPct)
          const isMenuOpen = menuCategory === e.category
          return (
            <tr key={e.category} className={`env-row ${isCC ? 'env-row-cc' : ''} ${isOverspent ? 'env-row-overspent' : ''} ${!isOverspent && !e.assigned && !e.spent && !e.available ? 'env-row-inactive' : ''}`}>
              <td className="env-cell env-cell-cat">
                {isCC ? (
                  <span className="env-cat-cc-label">
                    <span className="env-cc-icon">💳</span>
                    Credit Card Payment
                    <span className="env-cc-badge">payoff</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="env-cat-link"
                    onClick={() => navigate(`/expense/transactions?category=${encodeURIComponent(e.category)}`)}
                    title={`View ${e.category} transactions`}
                  >
                    {e.category}
                  </button>
                )}
                {!isCC && (
                  <div className="env-bar-track">
                    <div
                      className={`env-bar-fill ${isOverspent ? 'env-bar-red' : pct > 85 ? 'env-bar-warn' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </td>
              <td className="env-cell env-cell-num env-cell-assigned">
                {isCC ? <span className="env-cc-label">Set aside · </span> : null}
                {hideAmounts ? '---' : formatCurrency(e.assigned)}
              </td>
              <td className="env-cell env-cell-num env-cell-spent">
                {isCC ? <span className="env-cc-label">Paid · </span> : null}
                {hideAmounts ? '---' : formatCurrency(e.spent)}
              </td>
              <td className={`env-cell env-cell-num env-cell-avail ${isCC ? 'env-cell-cc' : isOverspent ? 'env-cell-negative' : hasBalance ? 'env-cell-positive' : ''}`}>
                {isCC ? <span className="env-cc-label">Owed · </span> : null}
                {hideAmounts ? '---' : formatCurrency(e.available)}
              </td>
              <td className="env-cell env-cell-action">
                <div className="env-action-wrap">
                  <button type="button" className="env-menu-trigger" onClick={() => {
                    if (isMenuOpen) {
                      setMenuCategory(null)
                      setMenuAssignCategory(null)
                      setMenuAssignValue('')
                    } else {
                      setMenuCategory(e.category)
                      setMenuAssignCategory(null)
                      setMenuAssignValue('')
                    }
                  }} title="Actions">
                    ⇄
                  </button>
                  {isMenuOpen && (
                    <div className="env-menu" ref={menuRef}>
                      {menuAssignCategory !== e.category ? (
                        <>
                          <button type="button" className="env-menu-item" onClick={() => { onMoveMoney(e.category); setMenuCategory(null) }}>
                            Move money between envelopes
                          </button>
                          <button type="button" className="env-menu-item" onClick={() => setMenuAssignCategory(e.category)}>
                            Assign from Ready to Assign
                          </button>
                          {isCC && e.available > 0 && (
                            <>
                              <div className="inv-action-divider" />
                              <button type="button" className="env-menu-item env-menu-item-danger" onClick={() => { onPayCreditCard?.(); setMenuCategory(null) }}>
                                Pay credit card bill
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="env-menu-assign">
                          <span className="env-menu-assign-label">Assign ₹</span>
                          <input
                            ref={inputRef}
                            type="number"
                            className="env-menu-assign-input"
                            value={menuAssignValue}
                            onChange={(e) => setMenuAssignValue(e.target.value)}
                            onKeyDown={handleAssignKeyDown}
                            min={1}
                            max={readyToAssign}
                            placeholder="amount"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
