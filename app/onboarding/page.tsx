'use client'

import { useState } from 'react'
import { Fredoka, Nunito } from 'next/font/google'
import '../../src/expense-redesign.css'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['600'], variable: '--font-fredoka', display: 'swap' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' })

const SLIDES = [
  {
    emoji: '💰',
    title: 'Give every rupee a job',
    body: 'Income lands in Ready to Assign. Move it into envelopes — rent, food, football — until nothing is unassigned.',
  },
  {
    emoji: '⚡',
    title: 'Log in three taps',
    body: 'The + button takes an amount, an envelope, and a note. That’s the whole ritual.',
  },
  {
    emoji: '🧠',
    title: 'Money Brain watches for you',
    body: 'Ask it anything about your month, and get a Wrapped recap when the month closes. Both live under You.',
  },
]

async function finishOnboarding() {
  try {
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardedAt: new Date().toISOString() }),
    })
  } finally {
    window.location.href = '/expense'
  }
}

export default function OnboardingPage() {
  const [slide, setSlide] = useState(0)
  const isLast = slide === SLIDES.length - 1
  const current = SLIDES[slide]

  return (
    <div className={`expense-redesign onboarding-page ${fredoka.variable} ${nunito.variable}`}>
      <div className="onboarding-top">
        <div className="onboarding-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === slide ? 'is-active' : ''}`} />
          ))}
        </div>
        <button type="button" className="onboarding-skip" onClick={finishOnboarding}>
          Skip tour
        </button>
      </div>

      <div className="onboarding-art" aria-hidden="true">
        {current.emoji}
      </div>

      <div className="onboarding-body">
        <h1 className="onboarding-title">{current.title}</h1>
        <p className="onboarding-copy">{current.body}</p>
      </div>

      <button
        type="button"
        className="auth-btn auth-btn--primary"
        onClick={() => (isLast ? finishOnboarding() : setSlide((s) => s + 1))}
      >
        {isLast ? 'Get started' : 'Next'}
      </button>
    </div>
  )
}
