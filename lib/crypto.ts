import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Application-layer field encryption for Mongo-stored data — defends against
 * a Mongo-only compromise (leaked dump, leaked MONGODB_URI, an Atlas network
 * list left open, a stolen backup). NOT end-to-end: the server must keep
 * decrypting, since the AI money-brain, weekly digest, CSV export, and every
 * report run server-side and need plaintext. The key lives in the same
 * Vercel env as MONGODB_URI, so a compromised app server still gets
 * everything — this is at-rest defence, nothing more.
 *
 * AES-256-GCM. Stored as `enc:<version>:<base64(iv‖tag‖ciphertext)>` — still
 * a plain BSON string, so nothing about the document shape changes. Not
 * deterministic: every encryption of the same plaintext produces different
 * ciphertext (random IV per call), which is why no encrypted field can be
 * used in a Mongo filter — see lib/scoped.ts's filter guard.
 */

const CURRENT_VERSION = 'v1'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const keys = new Map<string, Buffer>()

function getKey(version: string): Buffer {
  let key = keys.get(version)
  if (key) return key

  const envVar = `FIELD_KEY_${version.toUpperCase()}`
  const raw = process.env[envVar]
  if (!raw) throw new Error(`${envVar} is not set — required to encrypt/decrypt this field`)

  key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(`${envVar} must decode to exactly 32 bytes (got ${key.length}) — generate with: openssl rand -base64 32`)
  }
  keys.set(version, key)
  return key
}

/**
 * Encrypts `plain` under the current key version. `aad` (additional
 * authenticated data — not encrypted, but tamper-checked) should be
 * `${userId}:${collection}:${field}`: it stops an attacker with Atlas write
 * access from copying one user's ciphertext into another user's document
 * (or a different field) and having the server decrypt it for them, since
 * decryption fails unless the AAD matches exactly what was encrypted.
 */
export function encrypt(plain: string, aad: string): string {
  const key = getKey(CURRENT_VERSION)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64')
  return `enc:${CURRENT_VERSION}:${payload}`
}

const ENC_PREFIX_RE = /^enc:([^:]+):(.+)$/

/** True for a string this module actually encrypted (any known version prefix). */
export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && ENC_PREFIX_RE.test(value)
}

/**
 * Decrypts a value produced by `encrypt`. Passes through anything that isn't
 * a string, or doesn't start with `enc:` — this is what makes the rollout
 * (and any document the migration script missed) safe: plaintext and
 * ciphertext coexist, forever, and reads handle both without a schema
 * version anywhere else in the app.
 *
 * Throws (does not silently return garbage) on a value that looks encrypted
 * but fails to decrypt — wrong key, wrong AAD, or tampered ciphertext — so a
 * corrupted or mismatched-tenant value surfaces as a loud error, not mangled
 * text rendered to the wrong user.
 */
export function decrypt(value: unknown, aad: string): unknown {
  if (typeof value !== 'string') return value
  const match = ENC_PREFIX_RE.exec(value)
  if (!match) return value

  const [, version, payload] = match
  const key = getKey(version)
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

/** Constant-time-ish sanity check used only by the migration script's --verify. */
export function assertRoundTrips(plain: string, aad: string): void {
  const encrypted = encrypt(plain, aad)
  const decrypted = decrypt(encrypted, aad)
  const a = Buffer.from(String(decrypted), 'utf8')
  const b = Buffer.from(plain, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('round-trip mismatch')
  }
}
