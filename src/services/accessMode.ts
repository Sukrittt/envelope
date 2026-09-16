'use client'

import { clearLocalPrefs } from '../lib/localPref'

/**
 * Log out. Full navigation, since the session cookie is cleared server-side.
 * Browser-local preferences go first, or the next account signed in here
 * inherits this one's collapsed groups and recent categories.
 */
export function clearAccess(): void {
  clearLocalPrefs()
  window.location.href = '/logout'
}
