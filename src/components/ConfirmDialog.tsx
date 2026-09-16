'use client'

import type { ReactNode } from 'react'
import { Scrim, Sheet } from './MotionSheet'
import { clearAccess } from '../services/accessMode'

/** Small confirm modal; the caller supplies the confirm button(s) as children. Render inside <AnimatePresence>. */
export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  onCancel,
  children,
}: {
  title: string
  body?: string
  cancelLabel: string
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <Scrim className="erd-modal-overlay" onClick={onCancel}>
      <Sheet className="erd-modal-card archive-confirm" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3 className="archive-confirm-title">{title}</h3>
        {body && <p className="account-row-meta">{body}</p>}
        <div className="archive-confirm-actions">
          <button type="button" className="account-pill-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          {children}
        </div>
      </Sheet>
    </Scrim>
  )
}

/** Shared by the sidebar's Log out and the account page's Sign out. */
export function SignOutDialog({ onCancel }: { onCancel: () => void }) {
  return (
    <ConfirmDialog title="Sign out of Aviary?" body="You'll need to sign in again to see your budget." cancelLabel="Cancel" onCancel={onCancel}>
      <button type="button" className="account-danger-btn" style={{ marginTop: 0 }} onClick={clearAccess}>
        Sign out
      </button>
    </ConfirmDialog>
  )
}
