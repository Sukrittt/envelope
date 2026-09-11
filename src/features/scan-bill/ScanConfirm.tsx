'use client'

import { SuccessButton } from '@/src/components/SuccessButton'
import { formatDate, formatINR } from '@/src/lib/format'
import { ShareBar } from './ScanReview'
import type { ScanBillState } from './useScanBillController'

/** Twin of Mobile's ScanConfirm: where the share came from on the left, the total and the log button on the right. */
export function ScanConfirm(s: ScanBillState) {
  const { saving, success } = s.confirmButton

  return (
    <div className="scan-review">
      <div className="scan-col">
        <section className="scan-card scan-confirm-hero">
          <div className="scan-micro">Logging to {s.categoryLabel}</div>
          <div className="scan-hero-amount is-large">{formatINR(s.myShare)}</div>
          <div className="scan-meta">
            {formatDate(s.date)} · from a scanned bill of {formatINR(s.billTotal)}
          </div>
        </section>

        <div className="scan-micro">Where it came from</div>
        <ul className="scan-card scan-buckets" aria-label="Where your share came from">
          {s.buckets.map((b, i) => (
            <li key={b.divisor} className="scan-bucket" style={{ animationDelay: `${190 + Math.min(i, 6) * 45}ms` }}>
              <span className={`scan-badge ${b.divisor === 1 ? '' : 'is-accent'}`}>{b.divisor === 1 ? '1' : `÷${b.divisor}`}</span>
              <div className="scan-bucket-body">
                <strong>{b.divisor === 1 ? 'Fully mine' : `Split ${b.divisor} ways`}</strong>
                <span className="scan-meta">
                  {b.count} {b.count === 1 ? 'item' : 'items'} · {b.divisor === 1 ? '100% yours' : `you pay 1/${b.divisor}`}
                </span>
                <ShareBar
                  pct={Math.max(3, Math.round((b.share / Math.max(1, s.myShare)) * 100))}
                  height={4}
                  muted={b.divisor === 1}
                />
              </div>
              <div className="scan-bucket-amount">
                <strong>{formatINR(b.share)}</strong>
                <span className="scan-meta">of {formatINR(b.gross)}</span>
              </div>
            </li>
          ))}
          {s.hasFee && (
            <li className="scan-bucket">
              <span className="scan-badge is-accent">₹</span>
              <div className="scan-bucket-body">
                <strong>Fees &amp; discount, reconciled</strong>
                <span className="scan-meta">
                  {formatINR(s.feeAggregate)} split equally across {s.peopleCount} people
                </span>
              </div>
              <div className="scan-bucket-amount">
                <strong>{formatINR(s.feeShare)}</strong>
              </div>
            </li>
          )}
        </ul>
      </div>

      <aside className="scan-col scan-side">
        <section className="scan-card">
          <div className="scan-spread">
            <span className="scan-meta is-strong">Total bill</span>
            <strong>{formatINR(s.billTotal)}</strong>
          </div>
          <ShareBar pct={s.sharePct} height={8} />
          <div className="scan-spread scan-meta">
            <span className="scan-ink is-strong">
              You {formatINR(s.myShare)} · {s.sharePct}%
            </span>
            <span className="is-strong">Others {formatINR(s.billTotal - s.myShare)}</span>
          </div>
        </section>

        {s.confirmError && <p className="erd-log-error">{s.confirmError}</p>}

        <SuccessButton
          type="button"
          baseClass="erd-log-submit"
          className="scan-submit"
          saving={saving}
          success={success}
          successLabel="Expense saved"
          disabled={saving || success}
          onClick={s.handleConfirm}
        >
          Log {formatINR(s.myShare)} to {s.categoryLabel}
        </SuccessButton>
        <button type="button" className="scan-link-btn" disabled={saving || success} onClick={() => s.setPhase('review')}>
          Back to items
        </button>
      </aside>
    </div>
  )
}
