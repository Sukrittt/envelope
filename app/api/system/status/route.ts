import { json } from '@/lib/http'
import { getSystemSettings } from '@/lib/systemSettings'

export const dynamic = 'force-dynamic'

/** Public, unauthenticated: what every client needs to know about system state before calling anything else. */
export async function GET() {
  const { aiDisabled, maintenance } = await getSystemSettings()
  return json({ aiDisabled, maintenance: maintenance.on ? { on: true, message: maintenance.message } : { on: false, message: '' } })
}
