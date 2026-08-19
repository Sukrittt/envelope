import { signOut } from '@workos-inc/authkit-nextjs'

// Same reason as /login: gives client components a plain href to hit. signOut()
// clears the session cookie and redirects to the WorkOS logout endpoint, which
// ends the session on their side too (not just locally).
export async function GET() {
  await signOut()
}
