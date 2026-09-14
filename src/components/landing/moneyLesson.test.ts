import { describe, expect, it } from 'vitest'
import { initialLesson, lessonReducer, remaining, unassigned, type LessonState } from './lessonState'

const assignAll = (): LessonState => ['rent', 'food', 'savings', 'fun'].reduce(
  (s, category) => lessonReducer(s, { type: 'assign', category: category as 'rent' | 'food' | 'savings' | 'fun' }), initialLesson(),
)

describe('sample money lesson', () => {
  it('assigns money without spending it', () => {
    const state = assignAll()
    expect(state.balances).toEqual({ rent: 400, food: 300, savings: 200, fun: 100 })
    expect(unassigned(state)).toBe(0)
    expect(remaining(state)).toBe(1000)
    expect(state.spent).toBe(0)
  })
  it('ignores repeat assignment and premature spending or transfers', () => {
    const first = lessonReducer(initialLesson(), { type: 'assign', category: 'rent' })
    expect(lessonReducer(first, { type: 'assign', category: 'rent' })).toBe(first)
    expect(lessonReducer(first, { type: 'spend' })).toBe(first)
    expect(lessonReducer(first, { type: 'transfer' })).toBe(first)
    expect(unassigned(first)).toBe(600)
  })
  it('spends once from food and preserves savings', () => {
    const state = lessonReducer(assignAll(), { type: 'spend' })
    expect(state.balances).toEqual({ rent: 400, food: 200, savings: 200, fun: 100 })
    expect(remaining(state)).toBe(900)
    expect(state.spent).toBe(100)
    expect(lessonReducer(state, { type: 'spend' })).toBe(state)
  })
  it('transfers once without creating or spending money', () => {
    const spent = lessonReducer(assignAll(), { type: 'spend' })
    const state = lessonReducer(spent, { type: 'transfer' })
    expect(state.balances).toEqual({ rent: 400, food: 250, savings: 200, fun: 50 })
    expect(remaining(state)).toBe(900)
    expect(unassigned(state)).toBe(0)
    expect(lessonReducer(state, { type: 'transfer' })).toBe(state)
  })
  it('undoes all actions and resets complete state', () => {
    let state = lessonReducer(lessonReducer(assignAll(), { type: 'spend' }), { type: 'transfer' })
    state = lessonReducer(state, { type: 'undo' })
    expect(state.balances.food).toBe(200)
    state = lessonReducer(state, { type: 'undo' })
    expect(state.spent).toBe(0)
    expect(state.balances.food).toBe(300)
    expect(lessonReducer(state, { type: 'reset' })).toEqual(initialLesson())
    for (let i = 0; i < 4; i++) state = lessonReducer(state, { type: 'undo' })
    expect(state).toEqual(initialLesson())
  })
  it('conserves the initial amount after every transition', () => {
    let state = initialLesson()
    for (const category of ['fun', 'savings', 'rent', 'food'] as const) {
      state = lessonReducer(state, { type: 'assign', category })
      expect(Object.values(state.balances).reduce((a, b) => a + b, 0) + unassigned(state) + state.spent).toBe(1000)
    }
  })
})
