'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** One open at a time; the answer springs its height open instead of snapping. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(-1)
  return (
    <div className="lp-faq">
      {items.map((f, i) => (
        <div key={f.q} className="lp-faq-item">
          <button
            type="button"
            className="lp-faq-q"
            aria-expanded={open === i}
            onClick={() => setOpen((o) => (o === i ? -1 : i))}
          >
            {f.q}
            <span className={`lp-faq-icon${open === i ? ' is-open' : ''}`}>+</span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ height: { type: 'spring', bounce: 0, duration: 0.35 }, opacity: { duration: 0.2 } }}
                style={{ overflow: 'hidden' }}
              >
                <div className="lp-faq-answer">{f.a}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

const SHOTS = [
  { src: '/landing/home.jpeg', title: 'Home', caption: 'Ready to assign, front and centre. Envelopes underneath, nothing else.' },
  { src: '/landing/log-expense.jpeg', title: 'Log expense', caption: 'A full orange screen and a keypad. This is the screen you will use most.' },
  { src: '/landing/envelopes.jpeg', title: 'Envelopes', caption: 'Groups and categories, drag to reorder, add one in two taps.' },
  { src: '/landing/insights.jpeg', title: 'Insights', caption: 'Where it went, by category or group, in rupees or percent.' },
  { src: '/landing/activity.jpeg', title: 'Activity', caption: 'Every transaction, searchable, filtered down to this week in one tap.' },
  { src: '/landing/features.jpeg', title: 'You', caption: 'Wrapped, Money Brain, Scan a bill. The good stuff lives here.' },
]
const CARD_W = 236
const GAP = 26

export function Tour() {
  const [shot, setShot] = useState(0)
  const step = (d: number) => setShot((s) => (s + d + SHOTS.length) % SHOTS.length)

  return (
    <section className="lp-section">
      <div className="lp-play-head">
        <div>
          <div className="lp-eyebrow">THE TOUR</div>
          <h2 className="lp-h2">{SHOTS[shot].title}</h2>
          <p className="lp-sub" style={{ maxWidth: 520 }}>
            {SHOTS[shot].caption}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" aria-label="Previous screen" className="lp-round lp-round--ghost" onClick={() => step(-1)}>
            ‹
          </button>
          <button type="button" aria-label="Next screen" className="lp-round lp-round--accent" onClick={() => step(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="lp-tour-viewport">
        <div className="lp-tour-track" style={{ transform: `translateX(${-shot * (CARD_W + GAP)}px)` }}>
          {SHOTS.map((s, i) => (
            <button
              key={s.src}
              type="button"
              className="lp-tour-card"
              aria-label={`${s.title} screen`}
              onClick={() => setShot(i)}
              style={{ opacity: i === shot ? 1 : 0.42, transform: `scale(${i === shot ? 1 : 0.94})` }}
            >
              <div className="lp-tour-bezel">
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size screenshots, no need for next/image here */}
                <img src={s.src} alt="" loading="lazy" className="lp-tour-img" />
              </div>
              <div className="lp-tour-title">{s.title}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LaunchFilm() {
  const video = useRef<HTMLVideoElement>(null)
  const [idle, setIdle] = useState(true)

  return (
    <div className="lp-film-frame">
      <video ref={video} src="/landing/aviary-launch.mp4" controls playsInline preload="metadata" className="lp-film" />
      {idle && (
        <button
          type="button"
          className="lp-film-overlay"
          onClick={() => {
            setIdle(false)
            const v = video.current
            if (!v) return
            v.muted = false
            v.volume = 1
            void v.play()
          }}
        >
          <span className="lp-film-play">▶</span>
          <span className="lp-film-label">Play with sound</span>
        </button>
      )}
    </div>
  )
}
