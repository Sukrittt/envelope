'use client'

import { useEffect, useId, useReducer, useState, type CSSProperties } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, House, Pause, Play, RotateCcw, Sprout, Utensils, Undo2, Ticket } from 'lucide-react'
import { initialLesson, JOBS, lessonReducer, remaining, unassigned, type Job } from './lessonState'
import { AmountText } from './mobile/kit'

const icons = { rent: House, food: Utensils, savings: Sprout, fun: Ticket }
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`
const inheritStyle = { fontFamily: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit', lineHeight: 'inherit' } as const
function LessonAmount({ n, size }: { n: number; size: number }) {
  return <AmountText value={n} rawText={rupees(n)} size={size} weight="displayMedium" color="inherit" animate style={inheritStyle} />
}

function RupeeWorker({ job, assigned, reduced }: { job: Job; assigned: boolean; reduced: boolean }) {
  return <motion.div layoutId={reduced ? undefined : `worker-${job}`} transition={{ type: 'spring', stiffness: 190, damping: 24, duration: reduced ? 0 : undefined }} className={`money-worker${assigned ? ' is-working' : ''}`} aria-hidden="true">
    <span className="money-worker-value">₹</span><span className="money-worker-face"><i /><i /><b /></span>
    <span className="money-worker-feet"><i /><i /></span>
  </motion.div>
}

export function MoneyLesson() {
  const [state, dispatch] = useReducer(lessonReducer, undefined, initialLesson)
  const [playing, setPlaying] = useState(false)
  const reduced = !!useReducedMotion()
  const id = useId()
  const waiting = unassigned(state)
  const stage = waiting > 0 ? 0 : state.spent === 0 ? 1 : state.transferred ? 3 : 2
  const titles = ['Your money is ready. Give it a job.', 'All assigned. All still yours.', 'A little more for food?', 'New plan. Same money.']
  const explanations = [
    'Tap each envelope to send some money to work. These are sample amounts, not a suggested budget.',
    '₹0 unassigned means every rupee has a purpose. You still have ₹1,000. Now try buying lunch.',
    'Lunch came from Food. Rent and Savings stayed untouched. Move ₹50 from Fun to Food to adjust your plan.',
    'Food has ₹250 available. Fun has ₹50. Your ₹200 in Savings is still doing its job: being there for later.',
  ]

  useEffect(() => {
    if (!playing || stage === 3) return
    const timer = window.setTimeout(() => {
      const next = JOBS.find((j) => !state.assigned.includes(j.id))
      if (next) dispatch({ type: 'assign', category: next.id })
      else dispatch({ type: stage === 1 ? 'spend' : 'transfer' })
    }, stage === 0 ? 1800 : 4800)
    return () => window.clearTimeout(timer)
  }, [playing, stage, state.assigned])

  const act = (action: Parameters<typeof lessonReducer>[1]) => { setPlaying(false); dispatch(action) }
  const show = () => {
    if (stage === 3) dispatch({ type: 'reset' })
    setPlaying((p) => stage === 3 || !p)
  }

  return <section className="money-lesson" id="learn" aria-labelledby={`${id}-title`}>
    <div className="money-lesson-top"><button className="money-text-button" type="button" onClick={show}>{playing && stage !== 3 ? <Pause size={15} /> : <Play size={15} />}{playing && stage !== 3 ? 'Pause' : stage === 3 ? 'Replay' : 'Show me'}</button></div>
    <div className="money-stage-copy"><h2 id={`${id}-title`}>{titles[stage]}</h2><p>{explanations[stage]} <span className="money-sample-disclosure">A budgeting example using sample money.</span></p></div>
    <LayoutGroup id={id}>
      <div className={`money-waiting${waiting === 0 ? ' is-assigned' : ''}`}>
        <div><span>{waiting ? 'Waiting for a job' : 'Unassigned'}</span><strong><LessonAmount n={waiting} size={28} /></strong></div>
        <div className="money-waiting-workers" aria-hidden="true">
          {JOBS.filter((j) => !state.assigned.includes(j.id)).map((j) => <div key={j.id} style={{ '--job-color': j.color } as CSSProperties}><RupeeWorker job={j.id} assigned={false} reduced={reduced} /></div>)}
          {waiting === 0 && <span className="money-assigned-note"><Check size={20} /> Everyone has a purpose</span>}
        </div>
      </div>
      <div className="money-envelopes">
        {JOBS.map((job) => {
          const Icon = icons[job.id]
          const assigned = state.assigned.includes(job.id)
          return <button key={job.id} type="button" className={`money-envelope${assigned ? ' is-assigned' : ''}`} style={{ '--job-color': job.color } as CSSProperties} aria-label={assigned ? `${job.label}: ${rupees(state.balances[job.id])} available, assigned` : `Assign ${rupees(job.amount)} to ${job.label}`} aria-disabled={assigned} onClick={() => { if (!assigned) act({ type: 'assign', category: job.id }) }}>
            <span className="money-envelope-heading"><Icon size={19} aria-hidden="true" />{job.label}</span>
            <span className="money-envelope-scene" aria-hidden="true">{assigned ? <RupeeWorker job={job.id} assigned reduced={reduced} /> : <span className="money-envelope-place">+</span>}</span>
            <strong><LessonAmount n={assigned ? state.balances[job.id] : job.amount} size={26} /></strong>
            <span className="money-envelope-caption">{assigned ? 'Available' : 'Tap to assign'}</span>
            <span className="money-envelope-purpose">{job.purpose}</span>
          </button>
        })}
      </div>
    </LayoutGroup>
    <div className="money-lesson-bottom">
      <dl className="money-totals"><div><dt>Still yours</dt><dd><LessonAmount n={remaining(state)} size={25} /></dd></div><div><dt>Spent</dt><dd><LessonAmount n={state.spent} size={25} /></dd></div></dl>
      {stage === 1 && <button type="button" className="lp-button lp-button--dark" onClick={() => act({ type: 'spend' })}>Buy lunch · ₹100 <ArrowRight size={17} /></button>}
      {stage === 2 && <button type="button" className="lp-button lp-button--dark" onClick={() => act({ type: 'transfer' })}>Move ₹50 to Food <ArrowRight size={17} /></button>}
      {stage === 3 && <a className="lp-button lp-button--dark" href="#play">Try logging an expense <ArrowRight size={17} /></a>}
      {stage === 0 && <span className="money-small-note">Saving money is a job, too.</span>}
    </div>
    <div className="money-lesson-controls"><span>{['1. Assign', '2. Spend', '3. Adjust'].map((label, i) => <span key={label} aria-current={Math.min(stage, 2) === i ? 'step' : undefined}>{label}</span>)}</span><div><button type="button" className="money-text-button" disabled={!state.history.length} onClick={() => act({ type: 'undo' })}><Undo2 size={15} />Undo</button><button type="button" className="money-text-button" onClick={() => act({ type: 'reset' })}><RotateCcw size={15} />Reset</button></div></div>
    <p className="lp-sr-only" role="status" aria-atomic="true">{rupees(waiting)} unassigned. {rupees(remaining(state))} still yours. {rupees(state.spent)} spent. {JOBS.map((j) => `${j.label}: ${rupees(state.balances[j.id])} available.`).join(' ')}</p>
    <noscript><p>Assign ₹400 to Rent, ₹300 to Food, ₹200 to Savings and ₹100 to Fun. That leaves ₹0 unassigned, but all ₹1,000 is still yours. Spend ₹100 from Food and ₹900 remains. Move ₹50 from Fun to Food: you still have ₹900, with a different plan.</p></noscript>
  </section>
}
