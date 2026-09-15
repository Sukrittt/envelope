'use client'

/** Log out. Full navigation, since the session cookie is cleared server-side. */
export function clearAccess(): void {
  window.location.href = '/logout'
}
