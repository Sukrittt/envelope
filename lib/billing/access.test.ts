import { describe, it, expect } from 'vitest'
import { resolveAccess, trialWindow, pickSubscription } from './access'
import { TRIAL_DAYS, type BillingAccountDoc, type BillingSubscriptionDoc, type SubscriptionStatus } from './records'

const NOW = new Date('2026-09-18T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function account(overrides: Partial<BillingAccountDoc> = {}): BillingAccountDoc {
  const started = overrides.trialStartedAt ?? new Date(NOW.getTime() - 10 * DAY)
  return {
    _id: 'user_a',
    trialStartedAt: started,
    trialEndsAt: overrides.trialEndsAt ?? trialWindow(started).trialEndsAt,
    trialCohort: 'onboarding-v1',
    createdAt: started,
    ...overrides,
  }
}

function sub(status: SubscriptionStatus, expiresAt: Date | null, overrides: Partial<BillingSubscriptionDoc> = {}): BillingSubscriptionDoc {
  return {
    _id: undefined as never,
    userId: 'user_a',
    provider: 'revenuecat',
    environment: 'production',
    store: 'play',
    productId: 'envelope_individual',
    basePlanId: 'monthly',
    storeTransactionId: 'GPA.1',
    status,
    autoRenew: status === 'active',
    expiresAt,
    verifiedAt: NOW,
    providerRefs: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const resolve = (input: Partial<Parameters<typeof resolveAccess>[0]>) =>
  resolveAccess({ now: NOW, account: null, subscription: null, enforced: true, ...input })

describe('trialWindow', () => {
  it('is exactly 45 × 24h, not 45 calendar days', () => {
    const start = new Date('2026-09-18T12:00:00.000Z')
    expect(trialWindow(start).trialEndsAt.toISOString()).toBe('2026-11-02T12:00:00.000Z')
    expect(trialWindow(start).trialEndsAt.getTime() - start.getTime()).toBe(TRIAL_DAYS * DAY)
  })

  it('is unaffected by a DST-style calendar shift', () => {
    const start = new Date('2026-02-10T00:00:00.000Z')
    expect(trialWindow(start).trialEndsAt.getTime() - start.getTime()).toBe(TRIAL_DAYS * DAY)
  })
})

describe('resolveAccess trial boundary', () => {
  it('allows the last instant before expiry', () => {
    const acc = account({ trialEndsAt: new Date(NOW.getTime() + 1) })
    expect(resolve({ account: acc })).toMatchObject({ mode: 'trial', allowed: true, trialDaysRemaining: 0 })
  })

  it('blocks exactly at expiry', () => {
    const acc = account({ trialEndsAt: NOW })
    expect(resolve({ account: acc })).toMatchObject({ mode: 'expired', allowed: false })
  })

  it('floors remaining days', () => {
    const acc = account({ trialEndsAt: new Date(NOW.getTime() + 3 * DAY - 1) })
    expect(resolve({ account: acc }).trialDaysRemaining).toBe(2)
  })
})

describe('resolveAccess states', () => {
  it('reads no billing account as setup incomplete, not expired', () => {
    expect(resolve({}).mode).toBe('setup_incomplete')
  })

  it.each([
    ['active', true],
    ['cancelled', true],
    ['grace', true],
    ['on_hold', false],
    ['paused', false],
    ['expired', false],
    ['revoked', false],
    ['pending', false],
  ] as const)('status %s entitles: %s', (status, entitled) => {
    const access = resolve({ subscription: sub(status, new Date(NOW.getTime() + DAY)) })
    expect(access.mode).toBe(entitled ? 'paid' : 'setup_incomplete')
    expect(access.renewalState).toBe(status)
  })

  it('does not entitle an active subscription whose entitlement already ended', () => {
    expect(resolve({ subscription: sub('active', new Date(NOW.getTime() - 1)) }).mode).toBe('setup_incomplete')
  })

  it('does not entitle a pending purchase with no expiry', () => {
    expect(resolve({ subscription: sub('pending', null) }).mode).toBe('setup_incomplete')
  })

  it('leaves an existing trial intact while a purchase is pending', () => {
    const access = resolve({ account: account(), subscription: sub('pending', null) })
    expect(access).toMatchObject({ mode: 'trial', allowed: true, renewalState: 'pending' })
  })

  it('prefers a paid entitlement over a still-running trial', () => {
    expect(resolve({ account: account(), subscription: sub('active', new Date(NOW.getTime() + DAY)) }).mode).toBe('paid')
  })

  it('keeps access after a dead trial when the subscription is on hold, only if nothing else grants it', () => {
    const expiredTrial = account({ trialEndsAt: new Date(NOW.getTime() - DAY) })
    expect(resolve({ account: expiredTrial, subscription: sub('on_hold', new Date(NOW.getTime() + DAY)) })).toMatchObject({
      mode: 'expired',
      allowed: false,
    })
  })
})

describe('resolveAccess enforcement flag', () => {
  it('allows everything while enforcement is off but still reports the true mode', () => {
    const access = resolveAccess({ now: NOW, account: null, subscription: null, enforced: false })
    expect(access).toMatchObject({ mode: 'setup_incomplete', allowed: true, enforced: false })
  })
})

describe('pickSubscription', () => {
  it('returns null with no rows', () => {
    expect(pickSubscription([], NOW)).toBeNull()
  })

  it('picks the entitling row that lasts longest', () => {
    const short = sub('active', new Date(NOW.getTime() + DAY), { storeTransactionId: 'short' })
    const long = sub('cancelled', new Date(NOW.getTime() + 30 * DAY), { storeTransactionId: 'long' })
    expect(pickSubscription([short, long], NOW)?.storeTransactionId).toBe('long')
  })

  it('ignores a longer-dated row that does not entitle', () => {
    const live = sub('active', new Date(NOW.getTime() + DAY), { storeTransactionId: 'live' })
    const held = sub('on_hold', new Date(NOW.getTime() + 30 * DAY), { storeTransactionId: 'held' })
    expect(pickSubscription([held, live], NOW)?.storeTransactionId).toBe('live')
  })

  it('falls back to the most recently verified row so the client can explain the failure', () => {
    const old = sub('expired', new Date(NOW.getTime() - 30 * DAY), { storeTransactionId: 'old', verifiedAt: new Date(NOW.getTime() - 10 * DAY) })
    const recent = sub('on_hold', new Date(NOW.getTime() - DAY), { storeTransactionId: 'recent', verifiedAt: NOW })
    expect(pickSubscription([old, recent], NOW)?.storeTransactionId).toBe('recent')
  })
})
