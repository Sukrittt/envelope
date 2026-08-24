import { describe, it, expect } from 'vitest'
import { EMAIL_RE, escapeRegExp } from './http'

describe('EMAIL_RE', () => {
  it('accepts ordinary addresses', () => {
    expect(EMAIL_RE.test('a@b.com')).toBe(true)
    expect(EMAIL_RE.test('first.last+tag@sub.example.co')).toBe(true)
  })

  it('rejects addresses missing an @ or a domain dot', () => {
    expect(EMAIL_RE.test('not-an-email')).toBe(false)
    expect(EMAIL_RE.test('a@b')).toBe(false)
    expect(EMAIL_RE.test('@b.com')).toBe(false)
    expect(EMAIL_RE.test('a@')).toBe(false)
    expect(EMAIL_RE.test('a b@c.com')).toBe(false)
    expect(EMAIL_RE.test('')).toBe(false)
  })
})

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so the result matches only the literal string', () => {
    const raw = 'a.b*c?'
    const re = new RegExp(escapeRegExp(raw))
    expect(re.test('a.b*c?')).toBe(true)
    expect(re.test('aXbXcX')).toBe(false)
  })
})
