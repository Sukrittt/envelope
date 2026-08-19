import { redirect } from 'next/navigation'
import { getSignInUrl } from '@workos-inc/authkit-nextjs'

// A plain link target for client components, which cannot call the server-only
// getSignInUrl() themselves.
export async function GET() {
  redirect(await getSignInUrl())
}
