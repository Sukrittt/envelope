import { useEffect, useState } from 'react'

const PHRASES = [
  "Balancing the envelopes…",
  "Giving every rupee a job…",
  "Counting what's Ready to Assign…",
  "Chasing down last month's leftovers…",
  "Reconciling the chaos…",
  "Squeezing blood from the Bills envelope…",
  "Asking Rent to behave…",
  "Tallying the damage…",
  "Waking up the ledger…",
  "Making sure nothing's overspent (yet)…",
  "Checking if Groceries survived the week…",
  "Persuading Math to add up…",
  "Finding where all the money went…",
  "Teaching your budget to Budget…",
  "Begging the spending trend to flatten…",
  "Hoping the credit card behaves…",
  "Refreshing your financial reality…",
]

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface Props {
  className?: string
}

export function LoadingCaption({ className = '' }: Props) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [shuffledPhrases] = useState(() => shuffleArray(PHRASES))

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % shuffledPhrases.length)
    }, 1400)
    return () => clearInterval(interval)
  }, [shuffledPhrases.length])

  return (
    <div className={`loading-caption ${className}`}>
      <span className="loading-caption-text">{shuffledPhrases[phraseIndex]}</span>
    </div>
  )
}
