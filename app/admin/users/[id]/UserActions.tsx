'use client'

import { useActionState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionResult } from './actions'

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>

/** A form bound to one server action, with an optional native confirm() and inline result message. */
export function ActionForm({ action, confirm, children, className = 'adm-form' }: { action: Action; confirm?: string; children: ReactNode; className?: string }) {
  const [result, run] = useActionState(action, null)

  return (
    <form
      action={run}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
    >
      {children}
      {result && <span className={`adm-msg ${result.ok ? '' : 'is-error'}`}>{result.message}</span>}
    </form>
  )
}

export function SubmitButton({ children, variant }: { children: ReactNode; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={`adm-btn ${variant ? `is-${variant}` : ''}`} disabled={pending}>
      {pending ? 'Working…' : children}
    </button>
  )
}
