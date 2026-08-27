import { describe, it, expect } from 'vitest'
import { buildNotifications, type NotificationPrefs } from './rules'
import type { Envelope } from '@/src/types/expense'
import type { SummarizeExpensesMeta } from '@/lib/ai/expenseContext'

function envelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    category: 'Food',
    group: 'Living',
    assigned: 1000,
    spent: 500,
    available: 500,
    rolledOver: 0,
    isOverspent: false,
    spentPct: 50,
    ...overrides,
  }
}

function meta(overrides: Partial<SummarizeExpensesMeta> = {}): SummarizeExpensesMeta {
  return {
    txnCountThisMonth: 5,
    totalSpent: 500,
    totalAssigned: 1000,
    daysLeft: 15,
    daysElapsed: 15,
    totalDaysInMonth: 30,
    ...overrides,
  }
}

function prefs(overrides: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return {
    cadence: 'weekly',
    thresholds: true,
    bills: true,
    billLeadDays: 3,
    coach: true,
    ...overrides,
  }
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const MONTH = '2026-08'
const TODAY = '2026-08-15'

describe('buildNotifications — thresholds', () => {
  it('does not fire below any configured threshold', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 40 })],
      subscriptions: [],
      categories: [{ name: 'Food', alertPcts: [50, 90] }],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'threshold')).toHaveLength(0)
  })

  it('fires once exactly at a configured threshold', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 80, spent: 800 })],
      subscriptions: [],
      categories: [{ name: 'Food', alertPcts: [80] }],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    const thresholds = notifs.filter((n) => n.kind === 'threshold')
    expect(thresholds).toHaveLength(1)
    expect(thresholds[0].key).toBe(`thr:${MONTH}:Food:80`)
  })

  it('falls back to the default set [50, 90, 100] when a category has no alertPcts', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 95, spent: 950 })],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    const thresholds = notifs.filter((n) => n.kind === 'threshold').map((n) => n.key)
    expect(thresholds.sort()).toEqual([`thr:${MONTH}:Food:50`, `thr:${MONTH}:Food:90`].sort())
  })

  it('fires every crossed threshold in one pass, not just the highest', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 95, spent: 950 })],
      subscriptions: [],
      categories: [{ name: 'Food', alertPcts: [50, 90, 100] }],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    const thresholds = notifs.filter((n) => n.kind === 'threshold').map((n) => n.key)
    expect(thresholds.sort()).toEqual([`thr:${MONTH}:Food:50`, `thr:${MONTH}:Food:90`].sort())
  })

  it('an empty alertPcts opts a category out of threshold alerts entirely', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 99, spent: 990 })],
      subscriptions: [],
      categories: [{ name: 'Food', alertPcts: [] }],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'threshold')).toHaveLength(0)
  })

  it('raising a threshold mid-month produces a new key so it can fire again', () => {
    const build = (pct: number) =>
      buildNotifications({
        envelopes: [envelope({ spentPct: 90, spent: 900 })],
        subscriptions: [],
        categories: [{ name: 'Food', alertPcts: [pct] }],
        meta: meta(),
        prefs: prefs({ bills: false, coach: false }),
        today: TODAY,
        month: MONTH,
      })
    const a = build(80).find((n) => n.kind === 'threshold')
    const b = build(85).find((n) => n.kind === 'threshold')
    expect(a?.key).not.toBe(b?.key)
  })

  it('sends an overspent notification instead of a threshold one when over budget', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 100, spent: 1200, available: -200, isOverspent: true })],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'threshold')).toHaveLength(0)
    const overspent = notifs.filter((n) => n.kind === 'overspent')
    expect(overspent).toHaveLength(1)
    expect(overspent[0].key).toBe(`over:${MONTH}:Food`)
  })

  it('skips the credit-card sentinel envelope', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ category: '__credit_card__', isCreditCardPayment: true, spentPct: 100, isOverspent: true })],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'threshold' || n.kind === 'overspent')).toHaveLength(0)
  })
})

describe('buildNotifications — bills', () => {
  it('fires exactly on the lead-day boundary', () => {
    const due = isoDaysFromNow(3)
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [{ service: 'Netflix', amount_inr: 500, billing_cycle: 'monthly', next_due_date: due, status: 'active' }],
      categories: [],
      meta: meta(),
      prefs: prefs({ billLeadDays: 3 }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'bill')).toHaveLength(1)
  })

  it('does not fire one day past the lead-day boundary', () => {
    const due = isoDaysFromNow(4)
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [{ service: 'Netflix', amount_inr: 500, billing_cycle: 'monthly', next_due_date: due, status: 'active' }],
      categories: [],
      meta: meta(),
      prefs: prefs({ billLeadDays: 3 }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'bill')).toHaveLength(0)
  })

  it('skips cancelled subscriptions', () => {
    const due = isoDaysFromNow(3)
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [{ service: 'Netflix', amount_inr: 500, billing_cycle: 'monthly', next_due_date: due, status: 'cancelled' }],
      categories: [],
      meta: meta(),
      prefs: prefs({ billLeadDays: 3 }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'bill')).toHaveLength(0)
  })

  it('is suppressed by notifyBills: false', () => {
    const due = isoDaysFromNow(3)
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [{ service: 'Netflix', amount_inr: 500, billing_cycle: 'monthly', next_due_date: due, status: 'active' }],
      categories: [],
      meta: meta(),
      prefs: prefs({ billLeadDays: 3, bills: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'bill')).toHaveLength(0)
  })
})

describe('buildNotifications — digest', () => {
  it('uses a daily key under daily cadence', () => {
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ cadence: 'daily', bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    const digest = notifs.find((n) => n.kind === 'digest')
    expect(digest?.key).toBe(`digest:${TODAY}`)
  })

  it('uses a weekly key under weekly cadence', () => {
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ cadence: 'weekly', bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    const digest = notifs.find((n) => n.kind === 'digest')
    expect(digest?.key).toMatch(/^digest:w:2026-W\d{2}$/)
  })
})

describe('buildNotifications — coach', () => {
  it('fires when spending is projected to exceed the monthly budget', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 50 })],
      subscriptions: [],
      categories: [],
      meta: meta({ totalSpent: 900, totalAssigned: 1000, daysElapsed: 10, totalDaysInMonth: 30 }),
      prefs: prefs({ bills: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'coach')).toHaveLength(1)
  })

  it('does not fire when on track', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 30, spent: 300, available: 700 })],
      subscriptions: [],
      categories: [],
      meta: meta({ totalSpent: 300, totalAssigned: 1000, daysElapsed: 15, totalDaysInMonth: 30 }),
      prefs: prefs({ bills: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'coach')).toHaveLength(0)
  })

  it('is suppressed by notifyCoach: false', () => {
    const notifs = buildNotifications({
      envelopes: [],
      subscriptions: [],
      categories: [],
      meta: meta({ totalSpent: 900, totalAssigned: 1000, daysElapsed: 10, totalDaysInMonth: 30 }),
      prefs: prefs({ bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'coach')).toHaveLength(0)
  })
})

describe('buildNotifications — cadence off', () => {
  it('suppresses the digest, bills, and coach, but not category limit alerts', () => {
    const due = isoDaysFromNow(3)
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 100, isOverspent: true })],
      subscriptions: [{ service: 'Netflix', amount_inr: 500, billing_cycle: 'monthly', next_due_date: due, status: 'active' }],
      categories: [],
      meta: meta({ totalSpent: 900, totalAssigned: 1000, daysElapsed: 10, totalDaysInMonth: 30 }),
      prefs: prefs({ cadence: 'off' }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind !== 'overspent')).toHaveLength(0)
    expect(notifs.filter((n) => n.kind === 'overspent')).toHaveLength(1)
  })
})

describe('buildNotifications — thresholds off', () => {
  it('suppresses category limit alerts regardless of cadence', () => {
    const notifs = buildNotifications({
      envelopes: [envelope({ spentPct: 95, spent: 950 }), envelope({ category: 'Rent', spentPct: 100, isOverspent: true })],
      subscriptions: [],
      categories: [],
      meta: meta(),
      prefs: prefs({ cadence: 'daily', thresholds: false, bills: false, coach: false }),
      today: TODAY,
      month: MONTH,
    })
    expect(notifs.filter((n) => n.kind === 'threshold' || n.kind === 'overspent')).toHaveLength(0)
  })
})
