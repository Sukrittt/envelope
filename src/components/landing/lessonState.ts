export const JOBS = [
  { id: 'rent', label: 'Rent', amount: 400, purpose: 'Keeping a roof overhead', color: '#e7b7fd' },
  { id: 'food', label: 'Food', amount: 300, purpose: 'Taking care of lunch', color: '#b7e7a2' },
  { id: 'savings', label: 'Savings', amount: 200, purpose: 'Waiting for your future', color: '#a5d8ee' },
  { id: 'fun', label: 'Fun', amount: 100, purpose: 'Making room for a little joy', color: '#f8cb7b' },
] as const
export type Job = typeof JOBS[number]['id']
type Snapshot = { balances: Record<Job, number>; assigned: Job[]; spent: number; transferred: boolean }
export type LessonState = Snapshot & { history: Snapshot[] }
export type LessonAction = { type: 'assign'; category: Job } | { type: 'spend' | 'transfer' | 'undo' | 'reset' }
export const initialLesson = (): LessonState => ({ balances: { rent: 0, food: 0, savings: 0, fun: 0 }, assigned: [], spent: 0, transferred: false, history: [] })
export const remaining = (s: LessonState) => 1000 - s.spent
export const unassigned = (s: LessonState) => remaining(s) - Object.values(s.balances).reduce((a, b) => a + b, 0)

/** Pure, bounded teaching example; never reads or writes an account budget. */
export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  if (action.type === 'reset') return initialLesson()
  if (action.type === 'undo') {
    const previous = state.history.at(-1)
    return previous ? { ...previous, history: state.history.slice(0, -1) } : state
  }
  const { history, ...snapshot } = state
  const next = { ...state, balances: { ...state.balances }, history: [...history, snapshot] }
  if (action.type === 'assign') {
    const job = JOBS.find((j) => j.id === action.category)
    if (!job || state.assigned.includes(job.id) || job.amount > unassigned(state)) return state
    next.balances[job.id] += job.amount
    next.assigned = [...state.assigned, job.id]
  } else if (action.type === 'spend') {
    if (unassigned(state) !== 0 || state.spent !== 0 || state.balances.food < 100) return state
    next.balances.food -= 100
    next.spent = 100
  } else {
    if (state.spent !== 100 || state.transferred || state.balances.fun < 50) return state
    next.balances.fun -= 50
    next.balances.food += 50
    next.transferred = true
  }
  return next
}
