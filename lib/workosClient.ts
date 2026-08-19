import 'server-only'
import { WorkOS } from '@workos-inc/node'

let client: WorkOS | null = null

/** Server-side WorkOS SDK client, for flows authkit-nextjs doesn't cover (direct-provider OAuth, magic auth). */
export function getWorkOSClient(): WorkOS {
  if (!client) client = new WorkOS(process.env.WORKOS_API_KEY!)
  return client
}
