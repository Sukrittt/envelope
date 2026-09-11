'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SuccessButton, useButtonPhase } from '../components/SuccessButton'
import { submitFeedback, type FeedbackType } from '../api/feedback'
import { track } from '../lib/analytics'

const COPY: Record<FeedbackType, { titlePlaceholder: string; descriptionPlaceholder: string; submitLabel: string }> = {
  bug: {
    titlePlaceholder: "What's broken?",
    descriptionPlaceholder: 'What happened, and what did you expect instead?',
    submitLabel: 'Send report',
  },
  idea: {
    titlePlaceholder: 'What would this let you do?',
    descriptionPlaceholder: 'Tell us more about why it matters.',
    submitLabel: 'Send feedback',
  },
}

/**
 * `/account/feedback`. Twin of Mobile's account/feedback.tsx: files a GitHub
 * issue through app/api/feedback so a report never leaves the app. Mobile
 * picks the type by route param alone; here it's also a toggle, since the
 * form sits in the account rail where you can land on it directly.
 */
export function FeedbackPage({ initialType }: { initialType: FeedbackType }) {
  const router = useRouter()
  const [type, setType] = useState<FeedbackType>(initialType)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const { saving, success, start, succeed, fail } = useButtonPhase()
  const copy = COPY[type]
  const canSubmit = title.trim() !== '' && description.trim() !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || saving || success) return
    setError('')
    start()
    try {
      await submitFeedback(type, title, description)
      track('feedback_sent', { type })
      succeed(() => router.push('/account/help'))
    } catch (err) {
      fail()
      setError(
        err instanceof Error && err.message === 'rate_limited'
          ? "You've sent a few already. Try again later."
          : "Couldn't send that. Check your connection and try again.",
      )
    }
  }

  return (
    <form className="account-card feedback-form" onSubmit={handleSubmit}>
      <div className="account-segmented" role="group" aria-label="Feedback type" style={{ alignSelf: 'flex-start' }}>
        <button type="button" className={type === 'bug' ? 'is-active' : ''} onClick={() => setType('bug')}>
          Report a bug
        </button>
        <button type="button" className={type === 'idea' ? 'is-active' : ''} onClick={() => setType('idea')}>
          Send feedback
        </button>
      </div>

      <label className="erd-log-label" htmlFor="feedback-title">
        Title
      </label>
      <input
        id="feedback-title"
        className="erd-log-input"
        placeholder={copy.titlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <label className="erd-log-label" htmlFor="feedback-description">
        Details
      </label>
      <textarea
        id="feedback-description"
        className="erd-log-input feedback-textarea"
        placeholder={copy.descriptionPlaceholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={6}
      />
      <p className="recurring-hint">This becomes a public GitHub issue. Leave out passwords or personal details.</p>

      {error && <p className="erd-log-error">{error}</p>}

      <SuccessButton
        type="submit"
        baseClass="erd-log-submit"
        saving={saving}
        success={success}
        savingLabel="Sending…"
        successLabel="Sent"
        disabled={!canSubmit || saving || success}
      >
        {copy.submitLabel}
      </SuccessButton>
    </form>
  )
}
