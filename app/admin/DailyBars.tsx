import { lastNDays, num } from './format'

/** "2026-09-17" to "17 Sept". Parsed and printed in UTC so the calendar day never shifts. */
const shortDay = (day: string) => new Date(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * Zero-filled daily bar chart over the last `days` days. `counts` is keyed by IST YYYY-MM-DD.
 * Heights use a log scale so one bulk-import day doesn't flatten every normal day to nothing.
 */
export function DailyBars({ counts, days, unit }: { counts: Map<string, number>; days: number; unit: string }) {
  const series = lastNDays(days).map((day) => ({ day, value: counts.get(day) ?? 0 }))
  const peak = series.reduce((best, d) => (d.value > best.value ? d : best), series[0])
  const max = Math.max(1, peak.value)
  const scale = (v: number) => Math.log1p(v) / Math.log1p(max)
  // The count sitting at half height on the log scale.
  const midTick = Math.round(Math.expm1(Math.log1p(max) / 2))
  const total = series.reduce((sum, d) => sum + d.value, 0)
  const today = series[series.length - 1].value
  const mid = series[Math.floor(series.length / 2)].day

  return (
    <div>
      <div className="adm-stats">
        <div>
          <b>{num(total)}</b>
          <span>total, last {days} days</span>
        </div>
        <div>
          <b>{num(Math.round((total / days) * 10) / 10)}</b>
          <span>average per day</span>
        </div>
        <div>
          <b>{num(today)}</b>
          <span>today</span>
        </div>
        <div>
          <b>{num(peak.value)}</b>
          <span>busiest{peak.value > 0 ? `, ${shortDay(peak.day)}` : ''}</span>
        </div>
      </div>
      <div className="adm-chart">
        <div className="adm-yaxis" aria-hidden>
          <span>{num(max)}</span>
          <span>{num(midTick)}</span>
          <span>0</span>
        </div>
        <div className="adm-bars" role="img" aria-label={`${unit} per day, last ${days} days`}>
          {series.map((d) => (
            <div key={d.day} title={`${shortDay(d.day)}: ${num(d.value)} ${unit}`}>
              <div className={d.value === 0 ? 'is-zero' : undefined} style={{ height: `${scale(d.value) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="adm-bars-axis">
          <span>{shortDay(series[0].day)}</span>
          <span>{shortDay(mid)}</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  )
}
