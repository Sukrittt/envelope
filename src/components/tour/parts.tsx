import type { ReactNode } from 'react'

// Twin of Mobile's src/components/tour/parts.tsx, as CSS classes over
// react-native-reanimated's spring bounces — a desktop demo doesn't need a
// physics engine to read as alive; a CSS transition on state change is enough.

/** The small uppercase caption the tour uses above a block of demo rows. */
export function SectionLabel({ children }: { children: string }) {
  return <p className="tour-section-label">{children}</p>
}

/**
 * One demo row: emoji tile, name, a note under it, and whatever the chapter
 * wants on the right. Shared by the assign, move and rollover demos, which are
 * the same row with a different right-hand side.
 */
export function TourRow({
  emoji,
  name,
  note,
  noteClass,
  right,
  highlight,
}: {
  emoji: string
  name: string
  note: string
  noteClass?: string
  right: ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`tour-row ${highlight ? 'is-highlight' : ''}`}>
      <div className="tour-row-tile">{emoji}</div>
      <div className="tour-row-body">
        <span className="tour-row-name">{name}</span>
        <span className={`tour-row-note ${noteClass ?? ''}`}>{note}</span>
      </div>
      {right}
    </div>
  )
}

/** Flat mint or accent callout the chapters drop under a completed action. */
export function ResultCard({ tone, children }: { tone: 'mint' | 'accent'; children: ReactNode }) {
  return <div className={`tour-result-card is-${tone}`}>{children}</div>
}
