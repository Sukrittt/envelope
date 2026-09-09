import { describe, expect, it } from 'vitest'
import { computeShare, feeDiff, groupByDivisor, isFeeLine, type ScanItem } from './split'

describe('computeShare', () => {
  it('counts a "mine" item (divisor 1) in full', () => {
    const items: ScanItem[] = [{ name: 'Milk', price: 60, divisor: 1 }]
    expect(computeShare(items)).toBe(60)
  })

  it('halves a divisor-2 item', () => {
    const items: ScanItem[] = [{ name: 'Pizza', price: 800, divisor: 2 }]
    expect(computeShare(items)).toBe(400)
  })

  it('ignores a skipped item entirely', () => {
    const items: ScanItem[] = [{ name: 'Detergent', price: 380, divisor: null }]
    expect(computeShare(items)).toBe(0)
  })

  it('sums a mixed mine / split / skip list', () => {
    const items: ScanItem[] = [
      { name: 'Milk', price: 60, divisor: 1 },
      { name: 'Pizza', price: 800, divisor: 2 },
      { name: 'Detergent', price: 380, divisor: null },
    ]
    expect(computeShare(items)).toBe(460)
  })

  it('returns 0 for an empty list', () => {
    expect(computeShare([])).toBe(0)
  })

  it('rounds to 2dp instead of drifting on float division', () => {
    const items: ScanItem[] = [{ name: 'Snacks', price: 100, divisor: 3 }]
    expect(computeShare(items)).toBe(33.33)
  })
})

describe('feeDiff', () => {
  it('returns the delivery-fee gap between items and the printed total', () => {
    const items = [{ price: 60 }, { price: 40 }]
    expect(feeDiff(120, items)).toBe(20)
  })

  it('is 0 when items already sum to the total', () => {
    expect(feeDiff(60, [{ price: 60 }])).toBe(0)
  })

  it('is 0 for sub-paisa float noise', () => {
    const items = [{ price: 33.33 }, { price: 33.33 }, { price: 33.34 }]
    expect(feeDiff(100, items)).toBe(0)
  })

  it('returns a negative gap when the total is less than the item sum (a discount)', () => {
    expect(feeDiff(50, [{ price: 60 }])).toBe(-10)
  })
})

describe('isFeeLine', () => {
  it('matches fee and discount labels as words', () => {
    expect(isFeeLine('Delivery Fee')).toBe(true)
    expect(isFeeLine('Offer Discount')).toBe(true)
    expect(isFeeLine('Small-cart charge')).toBe(true)
  })

  it('does not treat product names containing fee as fee lines', () => {
    expect(isFeeLine('Bevzilla Café Coffee Kit Assorted')).toBe(false)
    expect(isFeeLine('Coffee Beans')).toBe(false)
  })
})

describe('groupByDivisor', () => {
  it('groups mixed divisors ascending, each with count/gross/share', () => {
    const items: ScanItem[] = [
      { name: 'Milk', price: 60, divisor: 1 },
      { name: 'Bread', price: 40, divisor: 1 },
      { name: 'Pizza', price: 800, divisor: 2 },
    ]
    expect(groupByDivisor(items)).toEqual([
      { divisor: 1, count: 2, gross: 100, share: 100 },
      { divisor: 2, count: 1, gross: 800, share: 400 },
    ])
  })

  it('excludes skipped (null-divisor) items', () => {
    const items: ScanItem[] = [
      { name: 'Milk', price: 60, divisor: 1 },
      { name: 'Detergent', price: 380, divisor: null },
    ]
    expect(groupByDivisor(items)).toEqual([{ divisor: 1, count: 1, gross: 60, share: 60 }])
  })

  it('returns an empty array for an empty or all-skipped list', () => {
    expect(groupByDivisor([])).toEqual([])
    expect(groupByDivisor([{ name: 'Detergent', price: 380, divisor: null }])).toEqual([])
  })

  it('rounds share to 2dp', () => {
    const items: ScanItem[] = [{ name: 'Snacks', price: 100, divisor: 3 }]
    expect(groupByDivisor(items)).toEqual([{ divisor: 3, count: 1, gross: 100, share: 33.33 }])
  })
})
