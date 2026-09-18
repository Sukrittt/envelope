import type { CSSProperties } from 'react'

const COLORS = ['gold', 'mint', 'coral', 'violet', 'blue']

// Twin of Mobile's SetupDone confetti: 18 pieces, staggered, drifting and
// spinning as they fall. Positions are a pure function of the index so there's
// nothing random to hydrate-mismatch.
export function Confetti() {
  return (
    <div className="setup-confetti" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="setup-confetti-piece"
          style={
            {
              left: `${6 + ((i * 5.3) % 88)}%`,
              width: 6 + (i % 4),
              height: 9 + (i % 6),
              background: `var(--${COLORS[i % 5]})`,
              animationDelay: `${i * 55}ms`,
              animationDuration: `${1700 + (i % 5) * 280}ms`,
              '--dx': `${(i % 2 ? 1 : -1) * (14 + ((i * 7) % 46))}px`,
              '--rot': `${180 + i * 37}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
