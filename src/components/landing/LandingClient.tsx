'use client'

import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Film, RotateCcw } from 'lucide-react'

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

export function LaunchFilm() {
  const video = useRef<HTMLVideoElement>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const retry = () => { setError(false); video.current?.load() }
  return <details className="lp-film-details" onToggle={(e) => {
    const next = e.currentTarget.open
    setOpen(next)
    if (!next) video.current?.pause()
  }}><summary><Film size={20} aria-hidden="true" /><span>See Aviary in 25 seconds</span><span className="lp-film-optional">Silent preview</span></summary>{open && <div className="lp-film-content"><video ref={video} muted controls playsInline preload="metadata" poster="/landing/film-poster.jpg" onError={() => setError(true)} aria-label="Aviary silent visual preview" onPlay={() => setError(false)}><source src="/landing/aviary-preview.mp4" type="video/mp4" /><track kind="descriptions" srcLang="en" label="English visual description" src="/landing/launch-description.vtt" /></video>{error && <p role="alert">The film couldn’t load. <button type="button" onClick={retry}><RotateCcw size={16} />Try again</button> You can also read the overview below.</p>}<details className="lp-film-transcript"><summary>Read the film’s visual description</summary><p>The film opens with “Where did my money go?” and sample purchases around a ₹10,000 balance. “Give every rupee a place” introduces category envelopes. A ₹180 coffee purchase goes to Eating Out, followed by its confirmation and available balance. It closes with Aviary’s name and “Less guessing. More living.” The interactive examples above explain the same budgeting ideas without needing to watch the film.</p></details></div>}</details>
}
