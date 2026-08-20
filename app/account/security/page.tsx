'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'

export default function SecurityPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/user')
      if (!res.ok) return
      const data = await res.json()
      setEmail(data.email)
    })()
  }, [])

  async function deleteAccount() {
    setDeleting(true)
    const res = await fetch('/api/user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    if (res.ok) {
      window.location.href = '/sign-in'
      return
    }
    setDeleting(false)
  }

  return (
    <>
      <div className="account-card">
        <div style={{ padding: 16 }}>
          <div className="account-section-label">Email</div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>{email || user?.email}</div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--mint)' }}>✓ Verified</div>
        </div>
        <div className="account-row" style={{ cursor: 'default' }}>
          <span className="account-row-icon" aria-hidden="true" style={{ color: 'var(--gold)' }}>
            G
          </span>
          <span className="account-row-label">Google</span>
          <span className="account-row-meta">{user?.profilePictureUrl ? 'Linked' : 'Not linked'}</span>
        </div>
      </div>

      <div>
        <div className="account-section-label" style={{ marginBottom: 10 }}>
          Sessions
        </div>
        <a href="/logout" className="account-row account-card" style={{ color: 'var(--gold)' }}>
          <span className="account-row-label">Sign out everywhere</span>
        </a>
      </div>

      <div className="account-danger-card">
        <div className="account-danger-title">Delete account</div>
        <div className="account-danger-copy">
          Removes envelopes, transactions and recaps. Export your data first — this can&apos;t be undone.
        </div>
        {confirmingDelete ? (
          <div className="account-confirm-panel">
            <div className="account-confirm-copy">
              This permanently deletes your account and all data. There is no undo.
            </div>
            <div className="account-confirm-actions">
              <button
                type="button"
                className="account-confirm-cancel"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button type="button" className="account-danger-btn" onClick={deleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="account-danger-btn" onClick={() => setConfirmingDelete(true)}>
            Delete account
          </button>
        )}
      </div>
    </>
  )
}
