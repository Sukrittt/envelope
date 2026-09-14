'use client'

import { useState, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'


export function LandingMotion({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion()
  return <MotionConfig reducedMotion="user" transition={reduced ? { duration: 0 } : undefined}>{children}</MotionConfig>
}

/** One open at a time; the answer springs its height open and closed instead of the browser's instant details toggle. */
export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState(-1)
  return <div className="lp-faq">{items.map((item, i) => <div className="lp-faq-item" key={item.q}>
    <button type="button" className="lp-faq-q" aria-expanded={open === i} onClick={() => setOpen((o) => (o === i ? -1 : i))}>
      {item.q}<span className={`lp-faq-icon${open === i ? ' is-open' : ''}`} aria-hidden="true">+</span>
    </button>
    <AnimatePresence initial={false}>
      {open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { type: 'spring', bounce: 0, duration: 0.35 }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
        <div className="lp-faq-answer">{item.a}</div>
      </motion.div>}
    </AnimatePresence>
  </div>)}</div>
}


