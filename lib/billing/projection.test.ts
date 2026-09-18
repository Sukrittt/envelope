import { describe, it, expect } from 'vitest'
import { projectSubscriber } from './projection'
import type { RcSubscriber, RcSubscription, RcEntitlement } from './revenuecat'

const NOW = new Date('2026-09-18T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString()
const ENT = 'aviary_pro'

function subscription(over: Partial<RcSubscription> = {}): RcSubscription {
  return {
    expires_date: iso(20),
    purchase_date: iso(-10),
    original_purchase_date: iso(-10),
    store: 'play_store',
    is_sandbox: false,
    unsubscribe_detected_at: null,
    billing_issues_detected_at: null,
    period_type: 'normal',
    product_plan_identifier: 'monthly',
    store_transaction_id: 'GPA.3333-4444-5555-66666..1',
    original_store_transaction_id: 'GPA.3333-4444-5555-66666',
    ...over,
  }
}

function subscriber(
  entitlement: Partial<RcEntitlement> | null,
  subs: Record<string, RcSubscription> = { envelope_individual: subscription() },
): RcSubscriber {
  return {
    original_app_user_id: 'user_a',
    subscriptions: subs,
    management_url: 'https://play.google.com/store/account/subscriptions',
    entitlements: entitlement
      ? {
          [ENT]: {
            expires_date: iso(20),
            purchase_date: iso(-10),
            product_identifier: 'envelope_individual',
            ...entitlement,
          },
        }
      : {},
  }
}

const project = (s: RcSubscriber) => projectSubscriber(s, ENT, NOW)

describe('projectSubscriber — the entitlement decides', () => {
  it('maps a live subscription to active', () => {
    expect(project(subscriber({}))).toMatchObject({
      status: 'active',
      autoRenew: true,
      productId: 'envelope_individual',
      basePlanId: 'monthly',
      environment: 'production',
      storeTransactionId: 'GPA.3333-4444-5555-66666',
      expiresAt: new Date(iso(20)),
    })
  })

  it('keeps access after auto-renew is turned off, and calls it cancelled', () => {
    const s = subscriber({}, { envelope_individual: subscription({ unsubscribe_detected_at: iso(-1) }) })
    expect(project(s)).toMatchObject({ status: 'cancelled', autoRenew: false, expiresAt: new Date(iso(20)) })
  })

  it('calls a billing issue with a live entitlement grace, not on hold', () => {
    const s = subscriber({}, { envelope_individual: subscription({ billing_issues_detected_at: iso(-1) }) })
    expect(project(s)).toMatchObject({ status: 'grace' })
  })

  it('calls a billing issue with a dead entitlement on hold', () => {
    const s = subscriber({ expires_date: iso(-1) }, { envelope_individual: subscription({ expires_date: iso(-1), billing_issues_detected_at: iso(-3) }) })
    expect(project(s)).toMatchObject({ status: 'on_hold', autoRenew: false })
  })

  it('extends entitlement to the end of a grace period', () => {
    const s = subscriber({ expires_date: iso(-1), grace_period_expires_date: iso(5) })
    expect(project(s)).toMatchObject({ status: 'active', expiresAt: new Date(iso(5)) })
  })

  it('does NOT revoke on a refund while the entitlement is still live', () => {
    const s = subscriber({}, { envelope_individual: subscription({ refunded_at: iso(-1) }) })
    // payment-subscriptions-plan.md: a refund is not automatically a revocation.
    expect(project(s)).toMatchObject({ status: 'active' })
  })

  it('revokes once the refund has also ended the entitlement', () => {
    const s = subscriber(null, { envelope_individual: subscription({ expires_date: iso(-1), refunded_at: iso(-1) }) })
    expect(project(s)).toMatchObject({ status: 'revoked', autoRenew: false })
  })

  it('reports a paused subscription', () => {
    const s = subscriber(null, { envelope_individual: subscription({ expires_date: iso(-1), auto_resume_date: iso(30) }) })
    expect(project(s)).toMatchObject({ status: 'paused' })
  })

  it('expires when the entitlement is simply gone', () => {
    const s = subscriber(null, { envelope_individual: subscription({ expires_date: iso(-1) }) })
    expect(project(s)).toMatchObject({ status: 'expired', autoRenew: false })
  })

  it('treats an entitlement expiring this instant as over', () => {
    expect(project(subscriber({ expires_date: NOW.toISOString() }))).toMatchObject({ status: 'expired' })
  })

  it('ignores an entitlement we do not sell', () => {
    const s = subscriber({})
    s.entitlements = { some_other_entitlement: s.entitlements[ENT] }
    expect(project(s)).toMatchObject({ status: 'expired' })
  })
})

describe('projectSubscriber — identity and environment', () => {
  it('marks a sandbox purchase, so test buys never pass for production', () => {
    const s = subscriber({}, { envelope_individual: subscription({ is_sandbox: true }) })
    expect(project(s)).toMatchObject({ environment: 'sandbox' })
  })

  it('keys on the original transaction id so a renewal updates one row', () => {
    const renewed = subscriber({ expires_date: iso(50) }, {
      envelope_individual: subscription({ expires_date: iso(50), store_transaction_id: 'GPA.3333-4444-5555-66666..2' }),
    })
    expect(project(renewed)?.storeTransactionId).toBe(project(subscriber({}))?.storeTransactionId)
  })

  it('falls back to a synthetic key when the store gave no transaction id', () => {
    const s = subscriber({}, { envelope_individual: subscription({ store_transaction_id: null, original_store_transaction_id: null }) })
    expect(project(s)?.storeTransactionId).toBe('user_a:envelope_individual')
  })

  it('returns null when there is nothing to record at all', () => {
    expect(project(subscriber(null, {}))).toBeNull()
  })

  it('honours a lifetime grant with no expiry rather than reading it as the epoch', () => {
    const s = subscriber({ expires_date: null }, {})
    expect(project(s)).toMatchObject({ status: 'active', expiresAt: null })
  })

  it('picks the most recent purchase when nothing entitles', () => {
    const s = subscriber(null, {
      old_product: subscription({ purchase_date: iso(-200), expires_date: iso(-170) }),
      newer_product: subscription({ purchase_date: iso(-30), expires_date: iso(-1) }),
    })
    expect(project(s)?.productId).toBe('newer_product')
  })
})
