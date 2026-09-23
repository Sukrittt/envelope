import { useEffect, useId, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Scrim, Sheet } from './MotionSheet'
import { useCurrency } from '@/src/context/CurrencyContext'
import { useDeleteExpense, useDismissDuplicate } from '../hooks/useExpenses'
import type { DuplicatePair } from '../api/expenses'
import type { ExpenseRow } from '../types'
import { formatShortDate } from '../lib/format'

function when(row: ExpenseRow): string {
  const time = new Date(row.timestamp)
  return Number.isNaN(time.getTime())
    ? formatShortDate(row.date)
    : `${formatShortDate(row.date)}, ${time.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
}

/**
 * Steps through flagged pairs one at a time: delete the newer copy, or keep
 * both. The list refetches after each answer, so the head is always the next pair.
 */
export function DuplicateReviewDialog({ pairs, onClose }: { pairs: DuplicatePair[]; onClose: () => void }) {
  const { formatCurrency } = useCurrency()
  const deleteExpense = useDeleteExpense()
  const dismiss = useDismissDuplicate()
  const [failed, setFailed] = useState(false)
  const id = useId()
  const primary = useRef<HTMLButtonElement>(null)
  const pair = pairs[0]
  const busy = deleteExpense.isPending || dismiss.isPending

  useEffect(() => {
    if (!pair) onClose()
  }, [pair, onClose])
  useEffect(() => primary.current?.focus(), [pair?.duplicate.id])

  if (!pair) return null
  const { duplicate, original } = pair

  async function run(action: () => Promise<unknown>) {
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    }
  }

  const rows: [string, (r: ExpenseRow) => string][] = [
    ['Item', (r) => r.item],
    ['Amount', (r) => formatCurrency(Number(r.amount_inr) || 0)],
    ['Logged', when],
    ['Category', (r) => r.category],
  ]

  return (
    <Scrim className="category-manager-overlay" style={{ zIndex: 210 }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <Sheet className="category-manager subscription-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
        <div className="txn-review">
          <span className="txn-review-icon" aria-hidden="true"><Copy size={22} /></span>
          <h4 id={`${id}-title`}>Logged twice?</h4>
          <p className="txn-review-intro">
            These look like the same purchase.{pairs.length > 1 ? ` ${pairs.length} to review.` : ''}
          </p>
          <div className="txn-review-comparison">
            <div className="txn-review-columns"><span>Earlier</span><span>Newer</span></div>
            {rows.map(([label, value]) => (
              <div className="txn-review-row" key={label}>
                <div className="txn-review-label">{label}</div>
                <div className="txn-review-values"><span>{value(original)}</span><span>{value(duplicate)}</span></div>
              </div>
            ))}
          </div>
          {failed && <p className="txn-review-note" role="alert">That didn&apos;t go through. It may have changed on another device; try again.</p>}
          <div className="txn-review-actions">
            <button type="button" ref={primary} className="txn-review-primary" disabled={busy}
              onClick={() => run(() => deleteExpense.mutateAsync({
                id: duplicate.id,
                version: duplicate.version,
                timestamp: duplicate.timestamp,
                item: duplicate.item,
                amountInr: Number(duplicate.amount_inr) || 0,
              }))}>
              Delete the newer one
            </button>
            <button type="button" className="txn-review-secondary" disabled={busy}
              onClick={() => run(() => dismiss.mutateAsync(duplicate.id!))}>
              Keep both
            </button>
          </div>
        </div>
      </Sheet>
    </Scrim>
  )
}
