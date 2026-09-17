'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { audit } from '@/lib/adminAudit'
import { getSystemSettings, saveSystemSettings, type SystemSettings } from '@/lib/systemSettings'
import type { ActionResult } from '../ActionForm'

const MESSAGE_MAX = 280

export async function saveSettingsAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const adminId = await requireAdmin()
  const message = String(form.get('maintenanceMessage') ?? '').trim().slice(0, MESSAGE_MAX)
  const next: SystemSettings = {
    aiDisabled: form.get('aiDisabled') === 'on',
    maintenance: { on: form.get('maintenanceOn') === 'on', message },
  }
  if (next.maintenance.on && !message) return { ok: false, message: 'Add a banner message before turning it on' }

  const before = await getSystemSettings()
  await saveSystemSettings(next)
  await audit(adminId, 'system.settings', null, { from: before, to: next })
  revalidatePath('/admin/system')
  return { ok: true, message: 'Saved. Other server instances pick this up within 30 seconds.' }
}
