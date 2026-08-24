import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'

const ORIGINAL_KEY = process.env.FIELD_KEY_V1

beforeEach(() => {
  // crypto.ts caches keys in a module-level Map — reset so each test's env
  // change (a fresh key, a deleted key, a malformed key) actually takes
  // effect instead of reusing whatever an earlier test already cached.
  vi.resetModules()
  process.env.FIELD_KEY_V1 = randomBytes(32).toString('base64')
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.FIELD_KEY_V1
  else process.env.FIELD_KEY_V1 = ORIGINAL_KEY
})

describe('encrypt/decrypt round trip', () => {
  it('round-trips an ordinary string', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    const ct = encrypt('Swiggy dinner', 'user_a:expenses:item')
    expect(decrypt(ct, 'user_a:expenses:item')).toBe('Swiggy dinner')
  })

  it('round-trips empty string and unicode', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    expect(decrypt(encrypt('', 'aad'), 'aad')).toBe('')
    expect(decrypt(encrypt('₹1,00,000 🎉 café', 'aad'), 'aad')).toBe('₹1,00,000 🎉 café')
  })

  it('round-trips a large string', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    const big = 'x'.repeat(10_000)
    expect(decrypt(encrypt(big, 'aad'), 'aad')).toBe(big)
  })
})

describe('output shape', () => {
  it('is prefixed enc:v1: and base64 after that, and differs from the plaintext', async () => {
    const { encrypt } = await import('./crypto')
    const ct = encrypt('hello', 'aad')
    expect(ct.startsWith('enc:v1:')).toBe(true)
    expect(ct).not.toContain('hello')
    const payload = ct.slice('enc:v1:'.length)
    expect(() => Buffer.from(payload, 'base64')).not.toThrow()
    expect(Buffer.from(payload, 'base64').length).toBeGreaterThanOrEqual(28) // 12 iv + 16 tag minimum
  })

  it('is non-deterministic — same input twice yields different ciphertext', async () => {
    const { encrypt } = await import('./crypto')
    expect(encrypt('same', 'aad')).not.toBe(encrypt('same', 'aad'))
  })
})

describe('passthrough for non-encrypted values', () => {
  it('returns plain strings, empty string, undefined, numbers unchanged', async () => {
    const { decrypt } = await import('./crypto')
    expect(decrypt('plain text', 'aad')).toBe('plain text')
    expect(decrypt('', 'aad')).toBe('')
    expect(decrypt(undefined, 'aad')).toBe(undefined)
    expect(decrypt(42, 'aad')).toBe(42)
    expect(decrypt(null, 'aad')).toBe(null)
  })

  it('isEncrypted only recognizes real enc: values', async () => {
    const { encrypt, isEncrypted } = await import('./crypto')
    expect(isEncrypted(encrypt('x', 'aad'))).toBe(true)
    expect(isEncrypted('plain')).toBe(false)
    expect(isEncrypted(42)).toBe(false)
    expect(isEncrypted(undefined)).toBe(false)
  })
})

describe('tamper and mismatch detection', () => {
  it('throws when the ciphertext is corrupted', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    const ct = encrypt('secret', 'aad')
    const tampered = ct.slice(0, -2) + (ct.at(-2) === 'A' ? 'B' : 'A') + ct.at(-1)
    expect(() => decrypt(tampered, 'aad')).toThrow()
  })

  it('throws when decrypted with the wrong AAD (different user/collection/field)', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    const ct = encrypt('secret', 'user_a:expenses:item')
    expect(() => decrypt(ct, 'user_b:expenses:item')).toThrow()
  })

  it('throws on an unknown key version instead of returning ciphertext as if it were plaintext', async () => {
    const { decrypt } = await import('./crypto')
    expect(() => decrypt('enc:v9:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'aad')).toThrow(/FIELD_KEY_V9/)
  })
})

describe('missing key', () => {
  it('throws a clear error rather than silently writing plaintext', async () => {
    delete process.env.FIELD_KEY_V1
    const { encrypt } = await import('./crypto')
    expect(() => encrypt('x', 'aad')).toThrow(/FIELD_KEY_V1/)
  })

  it('rejects a key that does not decode to 32 bytes', async () => {
    process.env.FIELD_KEY_V1 = Buffer.from('too short').toString('base64')
    const { encrypt } = await import('./crypto')
    expect(() => encrypt('x', 'aad')).toThrow(/32 bytes/)
  })
})
