import { describe, it, expect } from 'vitest'
import { changesOf, fmtValue } from './summarize'

describe('changesOf', () => {
  it('lists only the settings leaves that changed, with friendly labels', () => {
    const from = { aiDisabled: false, maintenance: { on: false, message: 'x' }, appUpdate: { android: { latestVersion: '2.3.1' } } }
    const to = { aiDisabled: true, maintenance: { on: false, message: 'x' }, appUpdate: { android: { latestVersion: '2.4.1' } } }
    expect(changesOf('system.settings', { from, to })).toEqual([
      { label: 'AI kill switch', from: false, to: true },
      { label: 'Android latest version', from: '2.3.1', to: '2.4.1' },
    ])
  })

  it('treats keys added since an older entry as unset -> value', () => {
    expect(changesOf('system.settings', { from: {}, to: { billing: { enforced: true } } })).toEqual([{ label: 'Billing enforced', from: undefined, to: true }])
  })

  it('reads user.update changes and returns null for other actions', () => {
    expect(changesOf('user.update', { changes: { name: { from: null, to: 'A' } } })).toEqual([{ label: 'Name', from: null, to: 'A' }])
    expect(changesOf('user.restore', { email: 'a@b.c' })).toBeNull()
  })

  it('identical settings produce no changes', () => {
    expect(changesOf('system.settings', { from: { aiDisabled: false }, to: { aiDisabled: false } })).toEqual([])
  })
})

describe('fmtValue', () => {
  it('names empty states instead of printing blanks', () => {
    expect([undefined, null, '', true, 5].map(fmtValue)).toEqual(['unset', 'none', 'empty', 'on', '5'])
  })
})
