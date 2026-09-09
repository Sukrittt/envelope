/**
 * Twin of Mobile/src/api/client.ts. Same job, different transport.
 *
 * There is no Authorization header and no BASE_URL: these are same-origin
 * requests, so the AuthKit session cookie rides along automatically and the
 * access token never touches JavaScript. Signed-out callers simply have no
 * cookie and `lib/access.ts::getAuth` answers as the read-only demo user.
 *
 * Mobile's `handleUnauthorized` has no counterpart here on purpose. A 401
 * needs a token the server rejects; web sends no token, and an absent or
 * unusable cookie falls through to the demo user at 200. The demo user's
 * writes are refused with 403 (`readOnlyGuard`), which is an ordinary
 * rejection each caller surfaces as a message, not a session to drop.
 */

const REQUEST_TIMEOUT_MS = 15_000

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  // Browser fetch has no default timeout — without one a hung connection pins
  // a screen's loading state forever. Callers already surface a thrown error
  // as a generic "check your connection" state, so the AbortError this throws
  // needs no special handling here.
  //
  // Presence of the key, not its value, decides: passing `signal: null` is how
  // a caller says "this one runs untimed" (streamChat, whose response is open
  // for as long as the model is talking). `init?.signal ?? timeout` would hand
  // that caller the 15s timeout it was trying to avoid.
  const signal = init && 'signal' in init ? init.signal : AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return fetch(path, { ...init, signal })
}

/**
 * Thrown by an API wrapper on a non-ok response, carrying the HTTP status so a
 * caller can tell "the server rejected this" apart from a transport failure
 * (which apiFetch above lets propagate as the original thrown error).
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Reads a `{error}` JSON body if present, falling back to a generic message. */
export async function apiErrorMessage(resp: Response, fallback: string): Promise<string> {
  try {
    const body = await resp.json()
    if (body && typeof body.error === 'string') return body.error
  } catch {
    // non-JSON body, fall through
  }
  return `${fallback}: ${resp.status}`
}
