'use client'

import { useEffect, useState } from 'react'

/** Site-wide notice driven by /admin/system. Fetched once per page load; silent on any failure. */
export function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/system/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (status?.maintenance?.on && status.maintenance.message) setMessage(status.maintenance.message)
      })
      .catch(() => {})
  }, [])

  if (!message) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 600,
        background: 'var(--tk-warn-soft)',
        color: 'var(--tk-warn-ink)',
        borderBottom: '1px solid var(--tk-warn)',
      }}
    >
      {message}
    </div>
  )
}
