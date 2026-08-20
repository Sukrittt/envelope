'use client'

import { useEffect, useState } from 'react'

interface Summary {
  transactionCount: number
  envelopeCount: number
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function exportData(format: 'csv' | 'json') {
  const res = await fetch(`/api/data/export?format=${format}`)
  if (!res.ok) return
  const data: Record<string, unknown> = await res.json()

  if (format === 'json') {
    downloadBlob(JSON.stringify(data, null, 2), 'mission-control-export.json', 'application/json')
    return
  }

  // Each key is a collection's CSV text; join into one readable multi-section file.
  const sections = Object.entries(data).map(([name, csv]) => `# ${name}\n${String(csv)}`)
  downloadBlob(sections.join('\n\n'), 'mission-control-export.csv', 'text/csv')
}

export default function DataPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/data/summary')
      if (!res.ok) return
      setSummary(await res.json())
    })()
  }, [])

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

  return (
    <>
      <div className="account-export-row">
        <div className="account-export-title">Export</div>
        <div className="account-export-meta">
          {summary ? `${summary.transactionCount} transactions · ${summary.envelopeCount} envelopes` : '—'}
        </div>
        <div className="account-export-actions">
          <button type="button" onClick={() => exportData('csv')}>
            CSV
          </button>
          <button type="button" onClick={() => exportData('json')}>
            JSON
          </button>
        </div>
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
