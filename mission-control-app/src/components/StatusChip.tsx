import type { Status } from '../types'

type StatusTone = Status | 'critical' | 'high' | 'med' | 'low' | 'overdue' | 'soon' | 'planned'

const toneMap: Record<StatusTone, 'green' | 'amber' | 'red'> = {
  green: 'green',
  amber: 'amber',
  red: 'red',
  critical: 'red',
  high: 'red',
  med: 'amber',
  low: 'green',
  overdue: 'red',
  soon: 'amber',
  planned: 'green',
}

const cueMap: Record<StatusTone, string> = {
  green: '[OK]',
  amber: '[~]',
  red: '[!]',
  critical: '[!!]',
  high: '[!]',
  med: '[~]',
  low: '[OK]',
  overdue: '[!]',
  soon: '[~]',
  planned: '[→]',
}

export function StatusChip({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`mc-chip mc-chip--${toneMap[tone]}`} aria-label={`${tone} status ${label}`}>
      <span className="mc-chip-cue" aria-hidden="true">
        {cueMap[tone]}
      </span>
      {label}
    </span>
  )
}
