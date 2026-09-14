import { useState } from 'react'
import { EXTRAS } from '@/src/components/tour/content'

/** Chapter 6: the rest of the app, one accordion row each. */
export function ExtrasList({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState<Record<number, boolean>>({})

  function toggle(index: number) {
    const next = { ...open }
    if (next[index]) delete next[index]
    else next[index] = true
    setOpen(next)
    if (Object.keys(next).length >= 2) onComplete()
  }

  return (
    <div className="tour-extras">
      {EXTRAS.map((extra, index) => {
        const isOpen = !!open[index]
        return (
          <div key={extra.name} className={`tour-extra-row ${isOpen ? 'is-open' : ''}`}>
            <button type="button" className="tour-extra-head" aria-expanded={isOpen} onClick={() => toggle(index)}>
              <div className="tour-row-tile">{extra.emoji}</div>
              <span className="tour-extra-name">{extra.name}</span>
              <span className={`tour-extra-plus ${isOpen ? 'is-open' : ''}`}>+</span>
            </button>
            {isOpen && <p className="tour-extra-desc">{extra.desc}</p>}
          </div>
        )
      })}
    </div>
  )
}
