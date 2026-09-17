import { lastNDays } from './format'

/** Zero-filled daily bar chart over the last `days` days. `counts` is keyed by IST YYYY-MM-DD. */
export function DailyBars({ counts, days, unit }: { counts: Map<string, number>; days: number; unit: string }) {
  const series = lastNDays(days).map((day) => ({ day, value: counts.get(day) ?? 0 }))
  const max = Math.max(1, ...series.map((d) => d.value))
  const total = series.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <div className="adm-sub" style={{ marginBottom: 10 }}>
        {total.toLocaleString('en-IN')} {unit} in {days} days
      </div>
      <div className="adm-bars" role="img" aria-label={`${unit} per day, last ${days} days`}>
        {series.map((d) => (
          <div key={d.day} style={{ height: `${(d.value / max) * 100}%` }} title={`${d.day}: ${d.value}`} />
        ))}
      </div>
      <div className="adm-bars-axis">
        <span>{series[0].day}</span>
        <span>{series[series.length - 1].day}</span>
      </div>
    </div>
  )
}
