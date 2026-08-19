import { handleAuth } from '@workos-inc/authkit-nextjs'

// WorkOS redirects here after sign-in; handleAuth exchanges the code and
// writes the sealed session cookie. Must match NEXT_PUBLIC_WORKOS_REDIRECT_URI
// and the redirect URIs registered in the WorkOS dashboard.
export const GET = handleAuth()
