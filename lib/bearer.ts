import { createRemoteJWKSet, jwtVerify } from 'jose'

// Split out of lib/access.ts so middleware.ts (edge runtime) can import these
// without pulling in access.ts's Node-only MongoDB dependency (lib/lastSeen.ts).

/**
 * WorkOS signs access tokens asymmetrically, so verification is a local
 * signature check against their published JWKS — no API call per request.
 * `createRemoteJWKSet` fetches once and caches the key set in-process, so this
 * is built lazily and reused rather than rebuilt per request.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://api.workos.com/sso/jwks/${process.env.WORKOS_CLIENT_ID}`),
    )
  }
  return jwks
}

/** The Bearer token from a request's Authorization header, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/**
 * Verify a WorkOS access token against their JWKS. Returns the resolved
 * identity, or null if the token is missing/expired/malformed/revoked.
 * Shared by `lib/access.ts::getAuth` and `middleware.ts`, which uses it to 401 a
 * mobile request carrying a dead token before it ever reaches a route
 * handler — see that file for why that case must NOT fall through to demo.
 *
 * Deliberately asserts no `issuer` and no `audience`, matching what WorkOS's
 * own SDK does for these tokens. Do not add either back: both have been tried
 * against production and both reject every real token. `issuer:
 * 'https://api.workos.com/'` and `'https://api.workos.com'` each logged
 * `unexpected "iss" claim value` on 100% of requests, and
 * `audience: WORKOS_CLIENT_ID` logged `missing required "aud" claim` — these
 * tokens carry no `aud` at all. The check that matters still runs: jose
 * validates the signature (and `exp`/`nbf`) before any claim, and `getJwks()`
 * is scoped to our own client id, so only our tenant's keys can sign a token
 * this accepts.
 */
export async function verifyBearerToken(
  token: string,
): Promise<{ userId: string; sessionId: string | null } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks())
    if (!payload.sub) return null
    return { userId: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : null }
  } catch (err) {
    console.warn('[auth] access token rejected:', (err as Error).message)
    return null
  }
}
