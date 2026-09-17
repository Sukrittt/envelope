import Link from 'next/link'
import { RANGES } from './format'

const LABELS: Record<(typeof RANGES)[number], string> = { 7: '7 days', 30: '30 days', 90: '90 days', 365: '1 year' }

/** Range switcher for one chart. Writes `param` into the URL and keeps every other search param as is. */
export function RangeTabs({ param, value, params }: { param: string; value: number; params: Record<string, string | undefined> }) {
  return (
    <nav className="erd-chart-toggle" aria-label="Date range">
      {RANGES.map((days) => {
        const next = new URLSearchParams(Object.entries({ ...params, [param]: String(days) }).filter((e): e is [string, string] => e[1] !== undefined))
        return (
          <Link key={days} href={`?${next}`} scroll={false} className={days === value ? 'is-active' : undefined} aria-current={days === value ? 'true' : undefined}>
            {LABELS[days]}
          </Link>
        )
      })}
    </nav>
  )
}
