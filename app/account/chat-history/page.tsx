'use client'

import { useEffect, useState } from 'react'

interface SessionSummary {
  id: string
  title: string
  updatedAt: string
}

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface SessionDetail extends SessionSummary {
  messages: ChatMessage[]
}

/** Written by hand (no Intl), matching this codebase's other relative-time labels. */
function timeAgoLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const minutes = Math.round((Date.now() - d.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export default function ChatHistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [selected, setSelected] = useState<SessionDetail | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/ai/chat/sessions')
      if (!res.ok) return
      setSessions(await res.json())
    })()
  }, [])

  async function openSession(id: string) {
    const res = await fetch(`/api/ai/chat/sessions/${id}`)
    if (!res.ok) return
    setSelected(await res.json())
  }

  if (selected) {
    return (
      <>
        <button type="button" className="account-row" style={{ cursor: 'pointer' }} onClick={() => setSelected(null)}>
          <span className="account-row-arrow" aria-hidden="true" style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>
            →
          </span>
          <span className="account-row-label">{selected.title}</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
          {selected.messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--gold-soft)' : 'var(--erd-card)',
                border: m.role === 'user' ? 'none' : '1px solid var(--erd-border)',
                borderRadius: 16,
                padding: '10px 14px',
                color: 'var(--erd-text)',
                fontSize: 14,
              }}
            >
              {m.text}
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="account-section-label" style={{ marginBottom: 10 }}>
        Chat history
      </div>
      {sessions === null ? (
        <div className="account-row-meta">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="account-row-meta">No past chats yet — start one from Money Brain on mobile.</div>
      ) : (
        <div className="account-card">
          {sessions.map((s) => (
            <button key={s.id} type="button" className="account-row" onClick={() => openSession(s.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="account-row-label">{s.title}</div>
                <div className="account-row-meta">{timeAgoLabel(s.updatedAt)}</div>
              </div>
              <span className="account-row-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
