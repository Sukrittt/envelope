import { json, error, readBody } from '@/lib/http'
import { getScope, guestWriteGuard } from '@/lib/access'
import { sendPushNotification } from '@/lib/push'

export const dynamic = 'force-dynamic'

/** Manual-trigger surface for `curl` testing. Features 2/3 call sendPushNotification() directly. */
export async function POST(req: Request) {
  const scope = getScope(req)
  const guard = guestWriteGuard(scope, 'POST')
  if (guard) return guard

  const body = await readBody(req)
  const title = body.title
  const bodyText = body.body
  if (typeof title !== 'string' || !title) return error('title required')
  if (typeof bodyText !== 'string' || !bodyText) return error('body required')

  const data = (body as Record<string, unknown>).data
  await sendPushNotification({
    title,
    body: bodyText,
    data: data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined,
  })
  return json({ ok: true })
}
