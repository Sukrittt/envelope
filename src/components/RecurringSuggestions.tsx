'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { loadRecurringSuggestions, scanRecurringSuggestions, dismissRecurringSuggestion } from '../api/recurringSuggestions'
import { useCurrency } from '../context/CurrencyContext'
import { useHideAmounts } from '../hooks/useHideAmounts'
import { formatDateShort } from '../lib/format'
import type { RecurringSuggestion, RecurringScan, ScanMonths } from '../types/recurringSuggestions'
import { RecurringExpenseModal } from './RecurringExpenseModal'

const baseKey = ['recurring-suggestions'] as const
export function RecurringSuggestions() {
  const qc = useQueryClient()
  const [months, setMonths] = useState<ScanMonths>(6)
  const key = [...baseKey, months] as const
  const { formatCurrency } = useCurrency()
  const [hideAmounts] = useHideAmounts()
  const [reviewing, setReviewing] = useState<RecurringSuggestion | null>(null)
  const [accepted, setAccepted] = useState<string[]>([])
  const query = useQuery({ queryKey: key, queryFn: () => loadRecurringSuggestions(months), staleTime: 30_000, retry: false })
  const scan = useMutation({ mutationFn: scanRecurringSuggestions, onSuccess: (data, scannedMonths) => qc.setQueryData([...baseKey, scannedMonths], data) })
  const dismiss = useMutation({ mutationFn: dismissRecurringSuggestion, onSuccess: (_, id) => {
    qc.setQueriesData<RecurringScan>({ queryKey: baseKey }, old => old ? { ...old, suggestions: old.suggestions.filter(s => s.id !== id) } : old)
  } })
  const data = query.data
  const suggestions = data?.suggestions.filter(s => !accepted.includes(s.id)) ?? []
  const busy = scan.isPending || dismiss.isPending
  const failure = scan.error ?? dismiss.error ?? query.error
  return (
    <section className="account-card" style={{ padding: 18, marginBottom: 20 }} aria-label="Find recurring expenses">
      <div className="account-section-label">Find recurring expenses</div>
      <p className="account-row-meta">Find repeated payments in your expense history. You choose what to add.</p>
      <label className="erd-log-label" htmlFor="recurring-scan-period">Scan period</label>
      <select id="recurring-scan-period" className="erd-log-input" value={months} disabled={busy} onChange={event => {
        setMonths(Number(event.target.value) as ScanMonths)
        scan.reset()
        dismiss.reset()
      }}>
        <option value={1}>Last month</option>
        <option value={3}>Last 3 months</option>
        <option value={6}>Last 6 months</option>
      </select>
      {months === 1 && <p className="account-row-meta">A month is useful for frequent payments. Choose 3 or 6 months to find monthly bills.</p>}
      <button type="button" className="account-compact-btn" disabled={busy || query.isLoading} onClick={() => scan.mutate(months)}>
        {scan.isPending ? 'Scanning expenses…' : data?.scannedAt && data.remaining > 0 ? 'Scan remaining patterns' : 'Find recurring expenses'}
      </button>
      <div role="status" aria-live="polite">
        {data?.scannedAt && <p className="account-row-meta">Last scanned {formatDateShort(data.scannedAt.slice(0, 10))} · {formatDateShort(data.windowStart)}–{formatDateShort(data.windowEnd)}</p>}
        {data?.scannedAt && <p className="account-row-meta">Saved results. Scan again to check new expenses.</p>}
        {data?.stale && <p className="account-row-meta">Some saved suggestions changed. Scan again to refresh them.</p>}
        {Boolean(data?.failed) && <p className="account-row-meta">Some patterns couldn’t be checked. Try scanning again.</p>}
        {data && data.remaining > 0 && data.scannedAt && <p className="account-row-meta">{data.remaining} new or changed patterns left to check.</p>}
        {data?.scannedAt && !data.stale && !data.remaining && !suggestions.length && <p className="account-row-meta">No new recurring suggestions in this period. Already tracked and dismissed payments are hidden.</p>}
      </div>
      {failure && <p className="erd-log-error" role="alert">{failure.message}</p>}
      {suggestions.length > 0 && <ul className="recurring-list" style={{ padding: 0, listStyle: 'none' }}>
        {suggestions.map(s => <li key={s.id} style={{ padding: '16px 0', borderTop: '1px solid var(--erd-border)' }}>
          <strong className="account-row-label">{s.input.item}</strong>
          <p className="account-row-meta">{formatCurrency(Number(s.input.amount_inr), hideAmounts)} · {s.input.frequency} · {s.kind === 'subscription' ? 'Likely subscription' : 'Repeated payment'}</p>
          <p className="account-row-meta">{s.occurrences} payments · {s.dates.map(formatDateShort).join(' · ')}</p>
          {s.variableAmount && <p className="account-row-meta">Amounts vary. Review the latest amount before setting up automatic logging.</p>}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button type="button" className="account-compact-btn" disabled={busy} onClick={() => setReviewing(s)}>Review and add</button>
            <button type="button" className="scan-link-btn" disabled={busy} onClick={() => dismiss.mutate(s.id)}>Dismiss</button>
          </div>
        </li>)}
      </ul>}
      {reviewing && <RecurringExpenseModal key={reviewing.id} initialValues={reviewing.input} suggestionId={reviewing.id} onClose={() => setReviewing(null)} onAdded={() => {
        setAccepted(old => [...old, reviewing.id])
        void qc.invalidateQueries({ queryKey: baseKey })
      }} />}
    </section>
  )
}
