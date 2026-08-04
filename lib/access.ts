import { NextResponse } from 'next/server'

export type Scope = 'real' | 'guest'

const DEMO_PREFIX = 'demo_'

/** Resolve the request scope from the ?mode=guest query param (default real). */
export function getScope(url: URL): Scope {
  return url.searchParams.get('mode') === 'guest' ? 'guest' : 'real'
}

/**
 * Map a base collection name to the collection actually used for a scope.
 * Guest mode reads from the read-only `demo_*` collections.
 */
export function resolveCollection(base: string, scope: Scope): string {
  return scope === 'guest' ? `${DEMO_PREFIX}${base}` : base
}

/** 403 response used for any write attempt in guest (read-only demo) mode. */
export function readOnlyResponse(): NextResponse {
  return NextResponse.json({ error: 'read-only in guest mode' }, { status: 403 })
}

/**
 * Return a 403 response when a guest scope tries a non-GET mutation, else null.
 * Matches the legacy behaviour (vite.config.ts read-only guard).
 */
export function guestWriteGuard(scope: Scope, method: string): NextResponse | null {
  if (scope === 'guest' && method !== 'GET') {
    return readOnlyResponse()
  }
  return null
}
