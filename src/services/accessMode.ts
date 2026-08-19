'use client'

import { useAuth } from '@workos-inc/authkit-nextjs/components'

export type AccessMode = 'real' | 'guest'

/**
 * Access is now derived from the WorkOS session rather than stored: signed in
 * is 'real', signed out is 'guest' (the read-only demo account the API serves
 * to unauthenticated requests). WorkOS owns session lifetime, so there is no
 * localStorage copy and no rolling expiry window to maintain.
 */

/** React hook that re-renders the consumer whenever the session changes. */
export function useAccessMode(): AccessMode {
  const { user, loading } = useAuth()
  return !loading && user ? 'real' : 'guest'
}

/** Log out. Full navigation, since the session cookie is cleared server-side. */
export function clearAccess(): void {
  window.location.href = '/logout'
}
