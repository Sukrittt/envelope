'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTourProgress } from '../../../src/hooks/useTourProgress'
import { useMoneyBrain } from '../../../components/MoneyBrainProvider'
import { CHAPTERS } from '../../../src/components/tour/content'
import { AssignDemo } from '../../../src/components/tour/demos/AssignDemo'
import { LogDemo } from '../../../src/components/tour/demos/LogDemo'
import { MoveDemo } from '../../../src/components/tour/demos/MoveDemo'
import { RolloverDemo } from '../../../src/components/tour/demos/RolloverDemo'
import { InsightsDemo } from '../../../src/components/tour/demos/InsightsDemo'
import { ExtrasList } from '../../../src/components/tour/demos/ExtrasList'

type View3 = 'hub' | 'chapter' | 'done'

/**
 * The guided tour: six chapters that explain the app by letting you poke at a
 * fake copy of it. Every demo is local state over the constants in
 * src/components/tour/content.ts, so nothing here can touch real money.
 * Twin of Mobile's app/account/guided-tour.tsx, sidebar-nested per the parity
 * plan instead of its own full-screen stack push.
 */
export default function GuidedTourPage() {
  const router = useRouter()
  const { openMoneyBrain } = useMoneyBrain()
  const [done, setDone] = useTourProgress()
  const [view, setView] = useState<View3>('hub')
  const [chapter, setChapter] = useState(0)

  const doneCount = done.size
  const firstOpen = CHAPTERS.findIndex((_, i) => !done.has(i))
  const current = CHAPTERS[chapter]
  const isLast = chapter === CHAPTERS.length - 1

  function complete(index: number) {
    setDone((prev) => (prev.has(index) ? prev : new Set(prev).add(index)))
  }

  // Chapter 5's real thing is a drawer, not a page — opening it in place beats
  // mobile's route push, which is the whole point of it living on the desktop shell.
  function openReal() {
    if (chapter === 4) {
      openMoneyBrain()
      return
    }
    router.push(current.href)
  }

  return (
    <>
      {view === 'hub' && (
        <Hub
          doneCount={doneCount}
          done={done}
          firstOpen={firstOpen}
          onOpen={(i) => {
            setChapter(i)
            setView('chapter')
          }}
          onStart={() => {
            if (firstOpen === -1) setView('done')
            else {
              setChapter(firstOpen)
              setView('chapter')
            }
          }}
        />
      )}

      {view === 'chapter' && (
        <div className="tour-chapter">
          <div className="tour-chapter-head">
            <button type="button" className="tour-back" onClick={() => setView('hub')} aria-label="Back to chapters">
              ←
            </button>
            <div className="tour-chapter-head-text">
              <p className="tour-kicker">{current.kicker}</p>
              <h2 className="tour-chapter-title">{current.title}</h2>
            </div>
            <button type="button" className="tour-skip" onClick={() => setView('done')}>
              Skip
            </button>
          </div>

          <p className="tour-chapter-lede">{current.lede}</p>
          <p className={`tour-chapter-nudge ${done.has(chapter) ? 'is-done' : ''}`}>
            {done.has(chapter) ? 'Nice. That is the whole idea.' : current.nudge}
          </p>

          <ChapterDemo index={chapter} onComplete={() => complete(chapter)} />

          {!isLast && (
            <button type="button" className="tour-try-real" onClick={openReal}>
              <div className="tour-try-real-tile">↗</div>
              <div className="tour-row-body">
                <span className="tour-row-name">Try it for real · {current.linkLabel}</span>
                <span className="tour-row-note">{current.linkNote ?? 'Opens the real page · your progress is saved'}</span>
              </div>
            </button>
          )}

          <div className="tour-footer">
            <div className="tour-dots">
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.title}
                  type="button"
                  aria-label={`Chapter ${i + 1}`}
                  className={`tour-dot ${chapter === i ? 'is-active' : done.has(i) ? 'is-done' : ''}`}
                  onClick={() => setChapter(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="setup-cta"
              onClick={() => {
                if (isLast) {
                  complete(chapter)
                  setView('done')
                } else setChapter(chapter + 1)
              }}
            >
              {isLast ? 'Finish the tour' : `Next · ${CHAPTERS[chapter + 1].title.toLowerCase()}`}
            </button>
            <button type="button" className="tour-center-link" onClick={() => setView('hub')}>
              All chapters
            </button>
          </div>
        </div>
      )}

      {view === 'done' && (
        <Done
          done={done}
          onOpen={(i) => {
            setChapter(i)
            setView('chapter')
          }}
          onFinish={() => router.push('/account')}
          onStartOver={() => {
            setDone(new Set())
            setChapter(0)
            setView('chapter')
          }}
        />
      )}
    </>
  )
}

function ChapterDemo({ index, onComplete }: { index: number; onComplete: () => void }) {
  if (index === 0) return <AssignDemo onComplete={onComplete} />
  if (index === 1) return <LogDemo onComplete={onComplete} />
  if (index === 2) return <MoveDemo onComplete={onComplete} />
  if (index === 3) return <RolloverDemo onComplete={onComplete} />
  if (index === 4) return <InsightsDemo onComplete={onComplete} />
  return <ExtrasList onComplete={onComplete} />
}

function Hub({
  done,
  doneCount,
  firstOpen,
  onOpen,
  onStart,
}: {
  done: Set<number>
  doneCount: number
  firstOpen: number
  onOpen: (index: number) => void
  onStart: () => void
}) {
  return (
    <div className="tour-hub">
      <div className="tour-hub-hero">
        <div className="tour-hub-badge">✉️</div>
        <div className="tour-row-body">
          <h2 className="tour-hub-title">Every rupee gets a job.</h2>
          <p className="tour-hub-subtitle">Six short chapters. All of them are pokeable, none of them touch your real money.</p>
        </div>
      </div>

      <div className="tour-hub-head">
        <span className="tour-kicker">THE TOUR</span>
        <span className="tour-kicker">
          {doneCount}/{CHAPTERS.length}
        </span>
      </div>

      <div className="account-card">
        {CHAPTERS.map((c, i) => {
          const isDone = done.has(i)
          return (
            <button key={c.title} type="button" className={`account-row tour-hub-row ${isDone ? 'is-done' : ''}`} onClick={() => onOpen(i)}>
              <span className={`tour-hub-badge-num ${isDone ? 'is-done' : ''}`}>{isDone ? '✓' : i + 1}</span>
              <span className="tour-hub-row-body">
                <span className="account-row-label">{c.title}</span>
                <span className="tour-hub-row-blurb">{c.blurb}</span>
              </span>
              <span className="account-row-arrow" aria-hidden="true">
                →
              </span>
            </button>
          )
        })}
      </div>

      <button type="button" className="setup-cta" onClick={onStart}>
        {doneCount === 0 ? 'Start the tour' : firstOpen === -1 ? 'See the recap' : `Continue · chapter ${firstOpen + 1}`}
      </button>
      <p className="tour-hub-footnote">Jump in anywhere · about 2 minutes end to end</p>
    </div>
  )
}

function Done({
  done,
  onOpen,
  onFinish,
  onStartOver,
}: {
  done: Set<number>
  onOpen: (index: number) => void
  onFinish: () => void
  onStartOver: () => void
}) {
  const doneCount = done.size

  return (
    <div className="tour-done">
      <div className="tour-done-medal">🏅</div>
      <h2 className="tour-done-title">{doneCount === CHAPTERS.length ? 'You know the whole app.' : `Tour done · ${doneCount} of ${CHAPTERS.length} poked.`}</h2>
      <p className="tour-done-subtitle">
        Fund the envelopes, log as you go, move money when life happens, start clean on the 1st. That is the entire loop.
      </p>

      <div className="account-card tour-done-recap">
        {CHAPTERS.map((c, i) => (
          <div key={c.title} className="account-row" style={{ cursor: 'default' }}>
            <span className={`tour-done-tick ${done.has(i) ? 'is-done' : ''}`}>{done.has(i) ? '✓' : '○'}</span>
            <span className="account-row-label" style={{ flex: 1 }}>
              {c.title}
            </span>
            <button type="button" className="tour-center-link" onClick={() => onOpen(i)}>
              {done.has(i) ? 'Revisit' : 'Try it'}
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="setup-cta" onClick={onFinish}>
        Back to my money
      </button>
      <button type="button" className="tour-center-link" onClick={onStartOver}>
        Start over
      </button>
    </div>
  )
}
