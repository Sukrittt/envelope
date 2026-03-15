import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadTransactions, type Transaction } from '../services/expenseTransactions'

type SortKey = 'date' | 'amountInr' | 'category'
type SortDir = 'asc' | 'desc'
type PeriodKey = 'week' | 'month' | 'custom'

const PAGE_SIZE = 20

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TransactionsView({ hideAmounts = false }: { hideAmounts?: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<PeriodKey>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  // Dropdown state
  const [catOpen, setCatOpen] = useState(false)
  const [catPos, setCatPos] = useState<{ top: number; left: number } | null>(null)
  const catTriggerRef = useRef<HTMLButtonElement>(null)
  const catMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTransactions()
      .then((rows) => {
        setTransactions(rows)
        if (rows.length) {
          let latest = new Date(0)
          for (const r of rows) {
            const d = new Date(r.date)
            if (!Number.isNaN(d.getTime()) && d > latest) latest = d
          }
          if (latest.getTime() === 0) latest = new Date()
          setCustomStart(toDateInput(new Date(latest.getFullYear(), latest.getMonth(), 1)))
          setCustomEnd(toDateInput(latest))
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort(), [transactions])

  const latestDate = useMemo(() => {
    if (!transactions.length) return new Date()
    let max = new Date(0)
    for (const t of transactions) {
      const d = new Date(t.date)
      if (!Number.isNaN(d.getTime()) && d > max) max = d
    }
    return max.getTime() === 0 ? new Date() : max
  }, [transactions])

  // Close dropdowns on outside click / escape
  useEffect(() => {
    if (!catOpen) return
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (catOpen && !catMenuRef.current?.contains(t) && !catTriggerRef.current?.contains(t)) setCatOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setCatOpen(false)
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => { window.removeEventListener('mousedown', handleClick); window.removeEventListener('keydown', handleKey) }
  }, [catOpen])

  // Position dropdowns
  useEffect(() => {
    if (catOpen) {
      const r = catTriggerRef.current?.getBoundingClientRect()
      if (r) setCatPos({ top: r.bottom + 4, left: r.left })
    }
  }, [catOpen])

  const filtered = useMemo(() => {
    let rows = [...transactions]

    // Date filter
    const end = new Date(latestDate)
    let start = new Date(0)
    if (period === 'week') {
      const now = new Date(end)
      start = new Date(now)
      const diffToMonday = (start.getDay() + 6) % 7
      start.setDate(now.getDate() - diffToMonday)
    } else if (period === 'month') {
      start = new Date(end.getFullYear(), end.getMonth(), 1)
    } else if (period === 'custom' && customStart && customEnd) {
      start = new Date(customStart); end.setTime(new Date(customEnd).getTime())
    }
    rows = rows.filter((t) => { const d = new Date(t.date); return d >= start && d <= end })

    if (selectedCategory) rows = rows.filter((t) => t.category === selectedCategory)

    const min = Number(amountMin)
    const max = Number(amountMax)
    if (!Number.isNaN(min) && amountMin) rows = rows.filter((t) => t.amountInr >= min)
    if (!Number.isNaN(max) && amountMax) rows = rows.filter((t) => t.amountInr <= max)

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((t) => t.item.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    }

    rows.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'amountInr') cmp = a.amountInr - b.amountInr
      else cmp = a.category.localeCompare(b.category)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return rows
  }, [transactions, period, customStart, customEnd, selectedCategory, amountMin, amountMax, search, sortKey, sortDir, latestDate])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [period, customStart, customEnd, selectedCategory, amountMin, amountMax, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totalSpend = useMemo(() => filtered.reduce((s, t) => s + t.amountInr, 0), [filtered])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'date' ? 'desc' : 'asc') }
  }

  function resetFilters() {
    setPeriod('week')
    setSelectedCategory('')
    setAmountMin('')
    setAmountMax('')
    setSearch('')
    setPage(0)
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  function renderDropdown(
    open: boolean, pos: { top: number; left: number } | null,
    menuRef: React.RefObject<HTMLDivElement | null>,
    options: string[], selected: string,
    onSelect: (v: string) => void, onClose: () => void, label: string,
  ) {
    if (!open || !pos) return null
    return createPortal(
      <div ref={menuRef} className="category-menu category-menu--portal" role="menu" aria-label={label}
        style={{ position: 'fixed', top: pos.top, left: pos.left, display: 'grid', minWidth: 180 }}>
        <div className="category-menu-list">
          <button type="button" className={`action-button is-ghost category-option ${!selected ? 'is-selected' : ''}`}
            onClick={() => { onSelect(''); onClose() }}>All</button>
          {options.map((o) => (
            <button type="button" key={o}
              className={`action-button is-ghost category-option ${selected === o ? 'is-selected' : ''}`}
              onClick={() => { onSelect(o); onClose() }}>{o}</button>
          ))}
        </div>
      </div>, document.body)
  }

  if (loading) {
    return (
      <div className="transactions-view">
        <div className="transactions-loading">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="transactions-view">
        <p className="transactions-empty">Couldn't load transactions. {error}</p>
      </div>
    )
  }

  return (
    <div className="transactions-view">
      <div className="transactions-filters">
        <div className="mc-filter-chips" role="tablist" aria-label="Period presets">
          {(['week', 'month', 'custom'] as PeriodKey[]).map((key) => (
            <button key={key} type="button" className={`action-button ${period === key ? 'is-active' : ''}`}
              onClick={() => setPeriod(key)}>
              {key === 'week' ? 'This week' : key === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="transactions-custom-dates">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" />
          </div>
        )}

        <button type="button" ref={catTriggerRef} className="action-button category-trigger"
          onClick={() => setCatOpen((o) => !o)} aria-haspopup="menu" aria-expanded={catOpen}>
          <span>{selectedCategory || 'Category'}</span> <span aria-hidden="true">▾</span>
        </button>

        <div className="transactions-amount-range">
          <input type="number" placeholder="Min ₹" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} aria-label="Minimum amount" />
          <input type="number" placeholder="Max ₹" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} aria-label="Maximum amount" />
        </div>

        <input type="search" className="transactions-search" placeholder="Search description or notes…"
          value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search transactions" />

        <button type="button" className="action-button is-ghost" onClick={resetFilters}>
          Reset
        </button>
      </div>

      {renderDropdown(catOpen, catPos, catMenuRef, categories, selectedCategory, setSelectedCategory, () => setCatOpen(false), 'Category filter')}

      {filtered.length === 0 ? (
        <p className="transactions-empty">No transactions for this filter.</p>
      ) : (
        <div className="transactions-table-wrap">
          <table className="mc-compact-table transactions-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('date')}>Date{sortIndicator('date')}</th>
                <th>Description</th>
                <th className="sortable" onClick={() => toggleSort('category')}>Category{sortIndicator('category')}</th>
                <th className="num sortable" onClick={() => toggleSort('amountInr')}>Amount{sortIndicator('amountInr')}</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t, i) => (
                <tr key={`${t.timestamp}-${i}`}>
                  <td>{formatDate(t.date)}</td>
                  <td>{t.item}</td>
                  <td>{t.category}</td>
                  <td className={`num ${hideAmounts ? 'amount-hidden' : ''}`}>{hideAmounts ? '---' : formatCurrency(t.amountInr)}</td>
                  <td className="transactions-notes">{t.notes || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="transactions-footer">
        <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div className="transactions-pagination">
            <button type="button" className="action-button is-ghost" disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>{page + 1} / {totalPages}</span>
            <button type="button" className="action-button is-ghost" disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
        <span>Total: {hideAmounts ? '---' : formatCurrency(totalSpend)}</span>
      </div>
    </div>
  )
}
