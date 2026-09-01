'use client'

import { useEffect, useState } from 'react'

interface Summary {
  transactionCount: number
  envelopeCount: number
}

interface ExportRow {
  id: string
  status: 'pending' | 'ready' | 'failed'
  created_at: string
  blob_url: string | null
}

interface ExportsResponse {
  exports: ExportRow[]
  usedThisMonth: number
  limit: number
}

async function fetchExports(): Promise<ExportsResponse | null> {
  const res = await fetch('/api/data/exports')
  if (!res.ok) return null
  return res.json()
}

export default function DataPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState<number | null>(null)
  const [exports, setExports] = useState<ExportsResponse | null>(null)
  const [starting, setStarting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/data/summary')
      if (!res.ok) return
      setSummary(await res.json())
    })()
  }, [])

  useEffect(() => {
    void fetchExports().then(setExports)
  }, [])

  // Poll only while something's still building — the push notification is
  // the real "it's done" signal, this just catches the UI up if the user is
  // still looking at the screen.
  useEffect(() => {
    if (!exports?.exports.some((e) => e.status === 'pending')) return
    const id = setInterval(() => void fetchExports().then(setExports), 4000)
    return () => clearInterval(id)
  }, [exports])

  async function startExport() {
    setStarting(true)
    setExportError(null)
    const res = await fetch('/api/data/export', { method: 'POST' })
    setStarting(false)
    if (res.status === 429) {
      // The atLimit banner below already covers this once the refetch lands.
      void fetchExports().then(setExports)
      return
    }
    if (!res.ok) {
      setExportError('Could not start export. Try again.')
      return
    }
    void fetchExports().then(setExports)
  }

  async function clearTransactions() {
    setClearing(true)
    const res = await fetch('/api/data/clear-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    setClearing(false)
    setConfirmingClear(false)
    if (res.ok) {
      const data = await res.json()
      setCleared(data.deleted ?? 0)
      setSummary((s) => (s ? { ...s, transactionCount: 0 } : s))
    }
  }

  const atLimit = exports ? exports.usedThisMonth >= exports.limit : false
  const pending = exports?.exports.some((e) => e.status === 'pending') ?? false

  return (
    <>
      <div className="account-export-row">
        <div className="account-export-title">Export</div>
        <div className="account-export-meta">
          {summary ? `${summary.transactionCount} transactions · ${summary.envelopeCount} envelopes` : '—'}
          {exports ? ` · ${exports.usedThisMonth} of ${exports.limit} exports used this month` : ''}
        </div>
        <div className="account-export-actions">
          <button type="button" onClick={startExport} disabled={starting || pending || atLimit}>
            {pending ? 'Building…' : starting ? 'Starting…' : 'Export'}
          </button>
        </div>
        {exportError ? <div className="account-confirm-copy">{exportError}</div> : null}
        {atLimit && !exportError ? (
          <div className="account-confirm-copy">
            You&apos;ve used all {exports?.limit} exports this month. Resets next month.
          </div>
        ) : null}
        {exports && exports.exports.length > 0 ? (
          <ul className="account-export-list">
            {exports.exports.map((e) => (
              <li key={e.id}>
                {e.status === 'ready' && e.blob_url ? (
                  <a href={e.blob_url} download>
                    {e.created_at}
                  </a>
                ) : (
                  <span>
                    {e.created_at} — {e.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button type="button" className="account-clear-btn" onClick={() => setConfirmingClear(true)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden="true">🧹</span>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>Clear all transactions</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--erd-text2)', marginTop: 2 }}>
              Keeps envelopes, wipes history
            </span>
          </span>
        </span>
      </button>

      {confirmingClear ? (
        <div className="account-confirm-panel">
          <div className="account-confirm-copy">
            This deletes every transaction. Envelopes and budgets stay. There is no undo.
          </div>
          <div className="account-confirm-actions">
            <button type="button" className="account-confirm-cancel" onClick={() => setConfirmingClear(false)} disabled={clearing}>
              Cancel
            </button>
            <button type="button" className="account-danger-btn" onClick={clearTransactions} disabled={clearing}>
              {clearing ? 'Clearing…' : 'Clear permanently'}
            </button>
          </div>
        </div>
      ) : null}

      {cleared !== null ? (
        <div className="account-confirm-copy">Cleared {cleared} transaction(s).</div>
      ) : null}
    </>
  )
}
