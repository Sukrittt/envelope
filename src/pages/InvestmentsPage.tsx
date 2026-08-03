import { useEffect, useMemo, useState } from 'react'
import { getHoldings, addHolding, deleteHolding, performHoldingAction, getHoldingEvents } from '../services/api'
import { ExpenseSidebar } from '../components/ExpenseSidebar'

interface Holding {
  name: string
  type: string
  value: number
  updatedAt: string
}

interface HoldingEvent {
  holdingName: string
  eventType: string
  amount: number
  previousValue: number
  newValue: number
  timestamp: string
}

const ASSET_COLORS: Record<string, string> = {
  Equity: '#5882FF',
  FD: '#5EE6A8',
  'Mutual Fund': '#C084FC',
  Gold: '#FFD166',
  Crypto: '#FF8B9A',
  Bonds: '#94A3B8',
}

function assetColor(type: string): string {
  return ASSET_COLORS[type] ?? '#6b7a8b'
}

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

function formatTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function eventLabel(type: string): string {
  switch (type) {
    case 'market_update': return 'Market update'
    case 'contribution': return 'Contribution'
    case 'withdrawal': return 'Withdrawal'
    default: return type
  }
}

export function InvestmentsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [events, setEvents] = useState<HoldingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState('')
  const [addValue, setAddValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [actionMenuHolding, setActionMenuHolding] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<{ holding: string; type: 'market_update' | 'contribution' | 'withdrawal' } | null>(null)
  const [actionAmount, setActionAmount] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const month = useMemo(() => new Date().toISOString().slice(0, 7), [])

  // `loading` starts true, so the initial mount is covered; later refreshes update in place.
  async function load() {
    try {
      const [holdingRows, eventRows] = await Promise.all([
        getHoldings(),
        getHoldingEvents(),
      ])
      setHoldings(holdingRows.map(r => ({
        name: r.name,
        type: r.type,
        value: Number(r.value) || 0,
        updatedAt: r.updated_at,
      })))
      setEvents(eventRows.map(r => ({
        holdingName: r.holding_name,
        eventType: r.event_type,
        amount: Number(r.amount) || 0,
        previousValue: Number(r.previous_value) || 0,
        newValue: Number(r.new_value) || 0,
        timestamp: r.timestamp,
      })))
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    // Fetches are awaited before any setState runs, keeping the initial load
    // asynchronous and avoiding the sync-setState-in-effect cascade.
    void (async () => {
      try {
        const [holdingRows, eventRows] = await Promise.all([
          getHoldings(),
          getHoldingEvents(),
        ])
        setHoldings(holdingRows.map(r => ({
          name: r.name,
          type: r.type,
          value: Number(r.value) || 0,
          updatedAt: r.updated_at,
        })))
        setEvents(eventRows.map(r => ({
          holdingName: r.holding_name,
          eventType: r.event_type,
          amount: Number(r.amount) || 0,
          previousValue: Number(r.previous_value) || 0,
          newValue: Number(r.new_value) || 0,
          timestamp: r.timestamp,
        })))
      } catch (e) {
        setError(String(e))
      }
      setLoading(false)
    })()
  }, [])

  const netWorth = useMemo(() => holdings.reduce((s, h) => s + h.value, 0), [holdings])

  async function handleAdd() {
    if (!addName.trim() || !addValue.trim()) return
    try {
      await addHolding({ name: addName.trim(), type: addType.trim() || 'Other', value: addValue.trim() })
      setShowAdd(false)
      setAddName('')
      setAddType('')
      setAddValue('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleDelete(name: string) {
    try {
      setActionMenuHolding(null)
      setActiveAction(null)
      await deleteHolding(name)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function handleConfirmAction() {
    if (!activeAction) return
    const parsed = Number(actionAmount)
    if (Number.isNaN(parsed) || parsed < 0) return
    setActionLoading(true)
    try {
      await performHoldingAction({
        name: activeAction.holding,
        action: activeAction.type,
        amount: activeAction.type === 'market_update' ? parsed : parsed,
        month,
      })
      setActionMenuHolding(null)
      setActiveAction(null)
      setActionAmount('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setActionLoading(false)
  }

  function openAction(holding: Holding, type: 'market_update' | 'contribution' | 'withdrawal') {
    setActiveAction({ holding: holding.name, type })
    setActionAmount(type === 'market_update' ? String(holding.value) : '')
  }

  if (loading) {
    return (
      <section className="expense-view">
        <div className="expense-layout">
          <ExpenseSidebar />
          <div className="expense-main">
            <div className="expense-tab-content">
              <div className="mc-panel">
                <div className="mc-panel-header"><h3>Investments</h3></div>
                <div className="txn-timeline-loading">Loading…</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="expense-view">
      <div className="expense-layout">
        <ExpenseSidebar />
        <div className="expense-main">
          <div className="expense-tab-content">
            <div className="mc-panel-header" style={{ padding: 'var(--sp-4) var(--sp-3)', margin: 0, borderBottom: '1px solid var(--divider-soft)' }}>
              <h3>Investments</h3>
              <button type="button" className="env-manage-btn" onClick={() => setShowAdd(true)}>+ Add</button>
            </div>

            {error && <div style={{ color: 'var(--risk-fg)', fontSize: 'var(--fs-12)', padding: 'var(--sp-3)' }}>{error}</div>}

            <div className="inv-net-worth">
              <span className="inv-nw-label">Net Worth</span>
              <span className="inv-nw-amount">{formatCurrency(netWorth)}</span>
            </div>

            {holdings.length > 0 && (
              <div className="inv-allocation">
                <div className="inv-allocation-bar">
                  {holdings.map(h => (
                    <div
                      key={h.name}
                      className="inv-allocation-segment"
                      style={{ width: `${Math.max(1, (h.value / netWorth) * 100)}%`, background: assetColor(h.type) }}
                      title={`${h.name}: ${((h.value / netWorth) * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <div className="inv-allocation-legend">
                  {holdings.map(h => {
                    const pct = (h.value / netWorth) * 100
                    return (
                      <span key={h.name} className="inv-legend-item">
                        <span className="inv-legend-dot" style={{ background: assetColor(h.type) }} />
                        {h.name}
                        <span className="inv-legend-pct">{pct.toFixed(1)}%</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            <table className="env-table">
              <thead>
                <tr className="env-table-header">
                  <th>Asset</th>
                  <th>Type</th>
                  <th className="env-th-num">Value</th>
                  <th className="env-th-num">Last Updated</th>
                  <th className="env-th-action" />
                </tr>
              </thead>
              <tbody>
                {holdings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="env-cell" style={{ textAlign: 'center', color: 'var(--muted-2)' }}>
                      No holdings yet. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  holdings.map(h => (
                    <tr key={h.name} className="env-row">
                      <td className="env-cell env-cell-cat">{h.name}</td>
                      <td className="env-cell inv-cell-type">{h.type}</td>
                      <td className="env-cell env-cell-num">{formatCurrency(h.value)}</td>
                      <td className="env-cell env-cell-num inv-cell-updated">{formatTime(h.updatedAt)}</td>
                      <td className="env-cell env-cell-action" style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="inv-action-btn"
                          onClick={() => setActionMenuHolding(actionMenuHolding === h.name ? null : h.name)}
                          title="Actions"
                        >
                          ⋯
                        </button>
                        {actionMenuHolding === h.name && !activeAction && (
                          <div className="inv-action-menu">
                            <button className="inv-action-opt" onClick={() => openAction(h, 'market_update')}>
                              <span className="inv-action-icon">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,13 5,8 9,10 15,3"/><polyline points="10,3 15,3 15,8"/></svg>
                              </span>
                              Update market value
                            </button>
                            <button className="inv-action-opt" onClick={() => openAction(h, 'contribution')}>
                              <span className="inv-action-icon">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><line x1="5" y1="8" x2="11" y2="8"/><line x1="8" y1="5" x2="8" y2="11"/></svg>
                              </span>
                              Add contribution
                            </button>
                            <button className="inv-action-opt" onClick={() => openAction(h, 'withdrawal')}>
                              <span className="inv-action-icon">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
                              </span>
                              Withdraw
                            </button>
                            <div className="inv-action-divider" />
                            <button className="inv-action-opt inv-action-danger" onClick={() => handleDelete(h.name)}>
                              <span className="inv-action-icon">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 4.5h9L11.5 15h-7L3.5 4.5z"/><line x1="2" y1="4.5" x2="14" y2="4.5"/><path d="M6.5 4.5v-2a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2"/></svg>
                              </span>
                              Delete
                            </button>
                          </div>
                        )}
                        {activeAction && activeAction.holding === h.name && (
                          <div className="inv-action-menu inv-action-form">
                            <button className="inv-action-opt inv-action-back" onClick={() => { setActiveAction(null); setActionAmount('') }}>
                              ← Actions
                            </button>
                            <div className="inv-action-body">
                              <span className="inv-action-desc">
                                {activeAction.type === 'market_update'
                                  ? 'Set new current value:'
                                  : activeAction.type === 'contribution'
                                    ? 'Amount being invested (deducted from Ready to Assign):'
                                    : 'Amount to withdraw (added to Ready to Assign):'}
                              </span>
                              <div className="inv-action-input-row">
                                <span className="inv-action-currency">₹</span>
                                <input
                                  className="inv-action-input"
                                  type="number"
                                  value={actionAmount}
                                  onChange={e => setActionAmount(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') handleConfirmAction(); if (e.key === 'Escape') { setActiveAction(null); setActionAmount('') } }}
                                  autoFocus
                                />
                              </div>
                              <div className="inv-action-buttons">
                                <button className="action-button is-ghost" onClick={() => { setActiveAction(null); setActionAmount('') }} disabled={actionLoading}>Cancel</button>
                                <button className="action-button" onClick={handleConfirmAction} disabled={actionLoading || !actionAmount}>
                                  {actionLoading ? 'Saving…' : 'Confirm'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {events.length > 0 && (
              <div className="inv-events-section">
                <button
                  className="inv-events-toggle"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? '▾' : '▸'} Activity History ({events.length})
                </button>
                {showHistory && (
                  <div className="inv-events-list">
                    {events.slice().reverse().map((e, i) => (
                      <div key={i} className="inv-event-row">
                        <span className="inv-event-time">{formatTime(e.timestamp)}</span>
                        <span className={`inv-event-type inv-event-type--${e.eventType}`}>{eventLabel(e.eventType)}</span>
                        <span className="inv-event-holding">{e.holdingName}</span>
                        <span className="inv-event-amount">
                          {e.eventType === 'withdrawal' ? '-' : '+'}{formatCurrency(e.amount)}
                        </span>
                        <span className="inv-event-delta">
                          {formatCurrency(e.previousValue)} → {formatCurrency(e.newValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {showAdd && (
            <div className="modal-overlay" onClick={() => setShowAdd(false)}>
              <div className="modal-content inv-add-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h4>Add Holding</h4>
                </div>
                <label className="inv-field">
                  <span>Name</span>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Stocks" />
                </label>
                <label className="inv-field">
                  <span>Type</span>
                  <select value={addType} onChange={e => setAddType(e.target.value)}>
                    <option value="">Select type…</option>
                    <option value="Equity">Equity</option>
                    <option value="FD">FD</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                    <option value="Gold">Gold</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Bonds">Bonds</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="inv-field">
                  <span>Value (₹)</span>
                  <input type="number" value={addValue} onChange={e => setAddValue(e.target.value)} placeholder="0" />
                </label>
                <div className="inv-add-actions">
                  <button type="button" className="action-button is-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                  <button type="button" className="action-button" onClick={handleAdd}>Add</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
