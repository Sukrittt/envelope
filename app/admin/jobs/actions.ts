'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { audit } from '@/lib/adminAudit'
import { CRON_JOBS, TRIGGER_HEADER, type CronJob } from '@/lib/cronRuns'
import type { ActionResult } from '../ActionForm'

/**
 * Runs a cron job now by calling its own route with CRON_SECRET, server to
 * server — the secret never reaches the browser, and the job runs exactly
 * the code Vercel's scheduler runs. The route records the run itself.
 */
export async function runJobAction(job: CronJob): Promise<ActionResult> {
  const adminId = await requireAdmin()
  const secret = process.env.CRON_SECRET
  if (!secret) return { ok: false, message: 'CRON_SECRET is not set' }

  // The app's own origin from config, never the request's Host header — that would let a forged Host receive CRON_SECRET.
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI
  if (!redirectUri) return { ok: false, message: 'NEXT_PUBLIC_WORKOS_REDIRECT_URI is not set' }
  const origin = new URL(redirectUri).origin
  const res = await fetch(`${origin}${CRON_JOBS[job]}`, {
    headers: { authorization: `Bearer ${secret}`, [TRIGGER_HEADER]: 'admin' },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))

  await audit(adminId, 'job.run', null, { job, status: res.status, result: body })
  revalidatePath('/admin/jobs')
  return res.ok ? { ok: true, message: `Done: ${JSON.stringify(body)}` } : { ok: false, message: `Failed (${res.status})` }
}
