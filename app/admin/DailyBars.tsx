import { lastNDays, num } from './format'

/** "2026-09-17" to "17 Sept". Parsed and printed in UTC so the calendar day never shifts. */
const shortDay = (day: string) => new Date(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * Zero-filled bar chart over the last `days` days. `counts` is keyed by IST YYYY-MM-DD.
 * Heights use a log scale so one bulk-import day doesn't flatten every normal day to nothing.
 * Ranges over 90 days draw one bar per week, since daily bars would be under a pixel wide.
 */
export function DailyBars({ counts, days, unit }: { counts: Map<string, number>; days: number; unit: string }) {
  const series = lastNDays(days).map((day) => ({ day, value: counts.get(day) ?? 0 }))
  const peak = series.reduce((best, d) => (d.value > best.value ? d : best), series[0])
  const size = days > 90 ? 7 : 1
  const bars: Array<{ label: string; value: number }> = []
  for (let end = series.length; end > 0; end -= size) {
    const chunk = series.slice(Math.max(0, end - size), end)
    const first = shortDay(chunk[0].day)
    const last = shortDay(chunk[chunk.length - 1].day)
    bars.unshift({ label: first === last ? first : `${first} – ${last}`, value: chunk.reduce((sum, d) => sum + d.value, 0) })
  }
  const max = Math.max(1, ...bars.map((b) => b.value))
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
          <b>{num(Number((total / days).toPrecision(2)))}</b>
          <span>average per day</span>
        </div>
        <div>
          <b>{num(today)}</b>
          <span>today</span>
        </div>
        <div>
          <b>{num(peak.value)}</b>
          <span>busiest day{peak.value > 0 ? `, ${shortDay(peak.day)}` : ''}</span>
        </div>
      </div>
      {size === 7 && <div className="adm-sub" style={{ marginBottom: 8 }}>Each bar is one week</div>}
      <div className="adm-chart">
        <div className="adm-yaxis" aria-hidden>
          <span>{num(max)}</span>
          <span>{num(midTick)}</span>
          <span>0</span>
        </div>
        <div
          className="adm-bars"
          role="img"
          aria-label={`${unit} per ${size === 7 ? 'week' : 'day'}, last ${days} days`}
          style={{ gap: bars.length > 60 ? 1 : 2 }}
        >
          {bars.map((b) => (
            <div key={b.label} title={`${b.label}: ${num(b.value)} ${unit}`}>
              <div className={b.value === 0 ? 'is-zero' : undefined} style={{ height: `${scale(b.value) * 100}%` }} />
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
