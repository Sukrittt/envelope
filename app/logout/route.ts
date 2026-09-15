import { signOut } from '@workos-inc/authkit-nextjs'

// Same reason as /login: gives client components a plain href to hit. signOut()
// clears the session cookie and redirects to the WorkOS logout endpoint, which
// ends the session on their side too (not just locally), then back to /sign-in.
// WorkOS only honours returnTo URLs listed under the dashboard's logout redirects.
export async function GET(request: Request) {
  await signOut({ returnTo: new URL('/sign-in', request.url).toString() })
}
