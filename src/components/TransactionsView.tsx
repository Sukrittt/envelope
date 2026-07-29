import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadTransactions, type Transaction } from '../services/expenseTransactions'

type PeriodKey = 'week' | 'month' | 'custom'

const PAGE_SIZE = 40

const INCOME_CATEGORIES = new Set(['Salary', 'Income', 'Refund', 'Cashback', 'Bonus', 'Interest', 'Gift', 'Transfer'])

const CATEGORY_ICONS: Record<string, string> = {
  'Bills': '📋',
  'Entertainment': '🎬',
  'Food': '🍔',
  'Football': '⚽',
  'Goa Shopping': '🛍️',
  'Groceries': '🛒',
  'Household': '🏠',
  'Personal': '👤',
  'Personal care': '🧴',
  'Shopping': '🛍️',
  'Subscription': '📡',
  'Travel': '🚗',
  'Water': '💧',
  'Work/Investment': '💼',
  'Betting': '🎲',
  'Rent': '🏠',
  'Transport': '🚗',
  'Utilities': '💡',
  'Education': '📚',
  'Health': '💊',
  'Medical': '💊',
  'Fitness': '🏋️',
  'Gifts': '🎁',
  'Clothing': '👕',
  'Electronics': '💻',
  'Pet': '🐾',
  'Coffee': '☕',
  'Misc': '📦',
  'Miscellaneous': '📦',
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS[category.toLowerCase()] ?? '💳'
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (iso === todayStr) return 'Today'
  if (iso === yesterdayStr) return 'Yesterday'

  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

type TimelineItem =
  | { kind: 'header'; date: string; label: string; total: number }
  | { kind: 'txn'; txn: Transaction }

export function TransactionsView({ hideAmounts = false }: { hideAmounts?: boolean }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<PeriodKey>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [catOpen, setCatOpen] = useState(false)
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

  const filtered = useMemo(() => {
    let rows = [...transactions]

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

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((t) => t.item.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    }

    rows.sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      if (cmp !== 0) return cmp
      return b.timestamp.localeCompare(a.timestamp)
    })

    return rows
  }, [transactions, period, customStart, customEnd, selectedCategory, search, latestDate])

  useEffect(() => { setPage(0) }, [period, customStart, customEnd, selectedCategory, search])

  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const g = groups.get(t.date) ?? []
      g.push(t)
      groups.set(t.date, g)
    }
    const items: TimelineItem[] = []
    for (const [date, txns] of groups) {
      const total = txns.reduce((s, t) => s + t.amountInr, 0)
      items.push({ kind: 'header', date, label: formatDateHeader(date), total })
      for (const txn of txns) {
        items.push({ kind: 'txn', txn })
      }
    }
    return items
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE))
  const paged = grouped.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalSpend = useMemo(() => filtered.reduce((s, t) => s + t.amountInr, 0), [filtered])

  function resetFilters() {
    setPeriod('week')
    setSelectedCategory('')
    setSearch('')
    setPage(0)
  }

  function renderPortal() {
    const r = catTriggerRef.current?.getBoundingClientRect()
    if (!catOpen || !r) return null
    return createPortal(
      <div ref={catMenuRef} className="category-menu category-menu--portal" role="menu" aria-label="Category filter"
        style={{ position: 'fixed', top: r.bottom + 4, left: r.left, display: 'grid', minWidth: 160 }}>
        <div className="category-menu-list">
          <button type="button" className={`action-button is-ghost category-option ${!selectedCategory ? 'is-selected' : ''}`}
            onClick={() => { setSelectedCategory(''); setCatOpen(false) }}>All</button>
          {categories.map((o) => (
            <button type="button" key={o}
              className={`action-button is-ghost category-option ${selectedCategory === o ? 'is-selected' : ''}`}
              onClick={() => { setSelectedCategory(o); setCatOpen(false) }}>{o}</button>
          ))}
        </div>
      </div>, document.body)
  }

  if (loading) {
    return (
      <div className="txn-timeline">
        <div className="txn-timeline-loading">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton-row" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="txn-timeline">
        <div className="txn-timeline-empty">Couldn't load transactions. {error}</div>
      </div>
    )
  }

  return (
    <div className="txn-timeline">
      <div className="txn-timeline-filters">
        <div className="mc-filter-chips" role="tablist" aria-label="Period presets">
          {(['week', 'month', 'custom'] as PeriodKey[]).map((key) => (
            <button key={key} type="button" className={`action-button ${period === key ? 'is-active' : ''}`}
              onClick={() => setPeriod(key)}>
              {key === 'week' ? 'This week' : key === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="txn-timeline-dates">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Start date" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="End date" />
          </div>
        )}

        <button type="button" ref={catTriggerRef} className="action-button category-trigger"
          onClick={() => setCatOpen((o) => !o)} aria-haspopup="menu" aria-expanded={catOpen}>
          <span>{selectedCategory || 'Category'}</span> <span aria-hidden="true">▾</span>
        </button>

        <input type="search" className="txn-timeline-search" placeholder="Search…"
          value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />

        <button type="button" className="action-button is-ghost" onClick={resetFilters}>
          Reset
        </button>
      </div>

      {renderPortal()}

      {filtered.length === 0 ? (
        <div className="txn-timeline-empty">No transactions for this filter.</div>
      ) : (
        <div className="txn-timeline-list">
          {paged.map((item, i) => {
            if (item.kind === 'header') {
              return (
                <div key={`h-${item.date}`} className="txn-timeline-header">
                  <span className="txn-timeline-header-label">{item.label}</span>
                  <span className={`txn-timeline-header-total ${hideAmounts ? 'amount-hidden' : ''}`}>
                    {hideAmounts ? '---' : formatCurrency(item.total)}
                  </span>
                </div>
              )
            }
            const t = item.txn
            const isIncome = INCOME_CATEGORIES.has(t.category)
            return (
              <div key={`t-${t.timestamp}-${i}`} className="txn-timeline-row">
                <span className="txn-timeline-icon" title={t.category}>{getCategoryIcon(t.category)}</span>
                <span className="txn-timeline-desc">
                  <span className="txn-timeline-item">{t.item}</span>
                  <span className="txn-timeline-category"> · {t.category}</span>
                </span>
                <span className={`txn-timeline-amount ${isIncome ? 'is-income' : 'is-expense'} ${hideAmounts ? 'amount-hidden' : ''}`}>
                  {hideAmounts ? '---' : `${isIncome ? '+' : '-'}${formatCurrency(t.amountInr)}`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="txn-timeline-footer">
        <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div className="txn-timeline-pagination">
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
