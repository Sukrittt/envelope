import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Envelope } from '../types/expense'

interface Props {
  envelopes: Envelope[]
  groups: string[]
  hideAmounts: boolean
  readyToAssign: number
  searchQuery: string
  sortKey: 'custom' | 'overspent-first' | 'alphabetical' | 'by-assigned'
  onMoveMoney: (category: string) => void
  onAssignFromRTA: (category: string, amount: number) => void
  onPayCreditCard?: () => void
}

const UNGROUPED_LABEL = 'Other'

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function usedPct(e: Envelope): number {
  if (e.assigned > 0) return Math.round((e.spent / e.assigned) * 100)
  return e.spent > 0 ? Infinity : 0
}

function lastSpentLabel(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  if (iso === todayStr) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Yesterday'
  const days = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (days >= 1 && days <= 31) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function compareEnvelopes(a: Envelope, b: Envelope, sortKey: Props['sortKey']): number {
  if (sortKey === 'custom') return 0
  if (sortKey === 'overspent-first') {
    if (a.isOverspent !== b.isOverspent) return a.isOverspent ? -1 : 1
    return a.available - b.available
  }
  if (sortKey === 'alphabetical') return a.category.localeCompare(b.category)
  return b.assigned - a.assigned
}

export function EnvelopeGrid({ envelopes, groups, hideAmounts, readyToAssign, searchQuery, sortKey, onMoveMoney, onAssignFromRTA, onPayCreditCard }: Props) {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
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

  function closeMenu() {
    setMenuCategory(null)
    setMenuAssignCategory(null)
    setMenuAssignValue('')
  }

  function openMenu(category: string) {
    if (menuCategory === category) closeMenu()
    else {
      setMenuCategory(category)
      setMenuAssignCategory(null)
      setMenuAssignValue('')
    }
  }

  function handleAssignKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const amount = Number(menuAssignValue)
      if (amount > 0 && amount <= readyToAssign && menuAssignCategory) {
        onAssignFromRTA(menuAssignCategory, amount)
      }
      closeMenu()
    }
    if (e.key === 'Escape') {
      setMenuAssignCategory(null)
      setMenuAssignValue('')
    }
  }

  const ccEnvelope = useMemo(() => envelopes.find((e) => e.isCreditCardPayment) ?? null, [envelopes])
  const regular = useMemo(() => envelopes.filter((e) => !e.isCreditCardPayment), [envelopes])

  const query = searchQuery.trim().toLowerCase()

  const grouped = useMemo(() => {
    const list: Array<{ label: string; items: Envelope[] }> = []
    const orderedGroups = groups.filter((g) => regular.some((e) => e.group === g))
    for (const g of orderedGroups) {
      list.push({ label: g, items: regular.filter((e) => e.group === g) })
    }
    const ungrouped = regular.filter((e) => !e.group)
    if (ungrouped.length > 0) list.push({ label: UNGROUPED_LABEL, items: ungrouped })
    return list
  }, [groups, regular])

  const matching = useMemo(() => {
    if (!query) return null
    return new Set(
      regular
        .filter((e) => e.category.toLowerCase().includes(query) || (e.group || UNGROUPED_LABEL).toLowerCase().includes(query))
        .map((e) => e.group || UNGROUPED_LABEL),
    )
  }, [query, regular])

  const visibleGroups = useMemo(() => {
    return grouped.filter((g) => !matching || matching.has(g.label))
  }, [grouped, matching])

  const isSearching = Boolean(query)
  const allExpanded = collapsed.size === 0

  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  function toggleAll() {
    if (allExpanded) setCollapsed(new Set(visibleGroups.map((g) => g.label)))
    else setCollapsed(new Set())
  }

  function groupTotals(items: Envelope[]) {
    let assigned = 0
    let spent = 0
    let available = 0
    for (const e of items) {
      assigned += e.assigned
      spent += e.spent
      available += e.available
    }
    return { assigned, spent, available }
  }

  function groupUsed(totals: { assigned: number; spent: number }): string {
    if (totals.assigned > 0) return `${Math.round((totals.spent / totals.assigned) * 100)}%`
    return totals.spent > 0 ? '∞' : '—'
  }

  function renderRow(e: Envelope, nested: boolean) {
    const isCC = e.isCreditCardPayment
    const isOverspent = e.isOverspent
    const hasBalance = e.available > 0
    const pct = Math.min(100, e.spentPct)
    const isMenuOpen = menuCategory === e.category
    const showDash = !isCC && e.assigned === 0 && e.spent === 0
    return (
      <tr key={e.category} className={`env-row ${nested ? 'env-row-nested' : ''} ${isCC ? 'env-row-cc' : ''} ${isOverspent ? 'env-row-overspent' : ''} ${!isOverspent && !e.assigned && !e.spent && !e.available ? 'env-row-inactive' : ''}`}>
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
        <td className="env-cell env-cell-num env-cell-assigned" title={isCC ? 'Set aside' : undefined}>
          {hideAmounts ? '---' : formatCurrency(e.assigned)}
        </td>
        <td className="env-cell env-cell-num env-cell-spent" title={isCC ? 'Paid' : undefined}>
          {hideAmounts ? '---' : formatCurrency(e.spent)}
        </td>
        <td className={`env-cell env-cell-num ${isCC ? 'env-cell-muted' : showDash ? 'env-cell-muted' : isOverspent ? 'env-cell-negative' : hasBalance ? 'env-cell-positive' : 'env-cell-muted'}`}>
          {isCC || showDash ? '—' : usedPct(e) === Infinity ? '∞' : `${usedPct(e)}%`}
        </td>
        <td className={`env-cell env-cell-num env-cell-avail ${isCC ? 'env-cell-cc' : isOverspent ? 'env-cell-negative' : hasBalance ? 'env-cell-positive' : ''}`} title={isCC ? 'Owed' : undefined}>
          {hideAmounts ? '---' : formatCurrency(e.available)}
        </td>
        <td className="env-cell env-cell-num env-cell-last">
          {lastSpentLabel(e.lastSpentDate)}
        </td>
        <td className="env-cell env-cell-action">
          <div className="env-action-wrap">
            <button type="button" className="env-menu-trigger" onClick={() => openMenu(e.category)} title="Actions">
              ⇄
            </button>
            {isMenuOpen && (
              <div className="env-menu" ref={menuRef}>
                {menuAssignCategory !== e.category ? (
                  <>
                    <button type="button" className="env-menu-item" onClick={() => { onMoveMoney(e.category); closeMenu() }}>
                      Move money between envelopes
                    </button>
                    <button type="button" className="env-menu-item" onClick={() => { setMenuAssignCategory(e.category); setMenuAssignValue('') }}>
                      Assign from Ready to Assign
                    </button>
                    {isCC && e.available > 0 && (
                      <>
                        <div className="inv-action-divider" />
                        <button type="button" className="env-menu-item env-menu-item-danger" onClick={() => { onPayCreditCard?.(); closeMenu() }}>
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
          <th className="env-th env-th-cat">
            <span className="env-th-toggle-all" role="button" tabIndex={0} onClick={toggleAll} onKeyDown={(e) => { if (e.key === 'Enter') toggleAll() }} title={allExpanded ? 'Collapse all groups' : 'Expand all groups'}>
              {allExpanded ? '▾' : '▸'} {allExpanded ? 'Collapse all' : 'Expand all'}
            </span>
          </th>
          <th className="env-th env-th-num">Assigned</th>
          <th className="env-th env-th-num">Spent</th>
          <th className="env-th env-th-num">Used</th>
          <th className="env-th env-th-num">Available</th>
          <th className="env-th env-th-last">Last spent</th>
          <th className="env-th env-th-action" />
        </tr>
      </thead>
      <tbody>
        {visibleGroups.map((group) => {
          const sortedItems = sortKey === 'custom' ? group.items : [...group.items].sort((a, b) => compareEnvelopes(a, b, sortKey))
          const isCollapsed = !isSearching && collapsed.has(group.label)
          const totals = groupTotals(group.items)
          const availableClass = totals.available < 0 ? 'env-cell-negative' : totals.available > 0 ? 'env-cell-positive' : 'env-cell-muted'
          return (
            <Fragment key={group.label}>
              <tr className={`env-group-row ${isCollapsed ? 'env-group-collapsed' : ''}`} onClick={() => toggleGroup(group.label)}>
                <td className="env-group-cell env-group-cell-cat">
                  <span className="env-group-toggle">{isCollapsed ? '▸' : '▾'}</span>
                  <span className="env-group-name">{group.label}</span>
                  <span className="env-group-count">{group.items.length} {group.items.length === 1 ? 'category' : 'categories'}</span>
                </td>
                <td className="env-group-cell env-group-num env-cell-assigned">{hideAmounts ? '---' : formatCurrency(totals.assigned)}</td>
                <td className="env-group-cell env-group-num env-cell-spent">{hideAmounts ? '---' : formatCurrency(totals.spent)}</td>
                <td className={`env-group-cell env-group-num ${totals.assigned > 0 ? (totals.spent > totals.assigned ? 'env-cell-negative' : 'env-cell-positive') : 'env-cell-muted'}`}>
                  {groupUsed(totals)}
                </td>
                <td className={`env-group-cell env-group-num env-cell-avail ${availableClass}`}>{hideAmounts ? '---' : formatCurrency(totals.available)}</td>
                <td className="env-group-cell env-group-num env-cell-last">—</td>
                <td className="env-group-cell env-group-action" />
              </tr>
              {!isCollapsed && sortedItems.map((e) => renderRow(e, true))}
            </Fragment>
          )
        })}
        {ccEnvelope && renderRow(ccEnvelope, false)}
      </tbody>
    </table>
  )
}
