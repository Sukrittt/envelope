import { STATES, STATE_ORDER, type State } from './states'
import { num } from '../format'

export interface RunwayBucket {
  label: string
  counts: Record<State, number>
  total: number
}

/**
 * When access runs out, bucketed forward from today.
 *
 * Stacked rather than summed because the answer differs by segment: a trial
 * ending is someone to convert, a paid entitlement ending is someone to keep,
 * and a gift ending is a decision we have to make ourselves.
 */
export function RunwayBars({ buckets, horizonDays }: { buckets: RunwayBucket[]; horizonDays: number }) {
  const max = Math.max(1, ...buckets.map((b) => b.total))
  const total = buckets.reduce((sum, b) => sum + b.total, 0)

  if (total === 0) {
    return <p className="adm-empty">Nobody loses access in the next {horizonDays} days.</p>
  }

  return (
    <div className="adm-chart">
      <div className="adm-yaxis" aria-hidden>
        <span>{num(max)}</span>
        <span>{num(Math.round(max / 2))}</span>
        <span>0</span>
      </div>
      <div className="adm-bars adm-stack" role="img" aria-label={`Accounts losing access per week over the next ${horizonDays} days`}>
        {buckets.map((bucket) => (
          <div key={bucket.label} title={`${bucket.label}: ${bucket.total} account(s)`}>
            {STATE_ORDER.filter((s) => bucket.counts[s] > 0).map((s) => (
              <i key={s} className={`adm-tone t-${s}`} style={{ height: `${(bucket.counts[s] / max) * 100}%` }} aria-hidden />
            ))}
          </div>
        ))}
      </div>
      <div className="adm-bars-axis">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  )
}

/** Shared legend for the stacked chart and the share bar. */
export function ToneLegend({ counts, of }: { counts: Record<State, number>; of?: number }) {
  return (
    <div className="adm-legend">
      {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
        <span key={s} className={`adm-tone t-${s}`}>
          <i aria-hidden />
          {STATES[s].label} <b>{num(counts[s])}</b>
          {of ? <span className="adm-muted"> · {Math.round((counts[s] / of) * 100)}%</span> : null}
        </span>
      ))}
    </div>
  )
}
