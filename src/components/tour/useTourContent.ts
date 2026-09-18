import { useMemo } from 'react'
import { useCurrency } from '@/src/context/CurrencyContext'
import { CHAPTERS, QUIZ_OPTIONS, QUIZ_QUESTION, BRAIN_ASKS, NOTIFY_KINDS } from './content'
export function useTourContent() {
  const { currencyText } = useCurrency()
  return useMemo(() => ({
    CHAPTERS: CHAPTERS.map(c => ({ ...c, nudge: currencyText(c.nudge) })),
    QUIZ_QUESTION: currencyText(QUIZ_QUESTION),
    QUIZ_OPTIONS: QUIZ_OPTIONS.map(o => ({ ...o, label: currencyText(o.label), feedback: currencyText(o.feedback) })),
    BRAIN_ASKS: BRAIN_ASKS.map(b => ({ ...b, q: currencyText(b.q), a: currencyText(b.a) })),
    NOTIFY_KINDS: NOTIFY_KINDS.map(k => ({ ...k, body: currencyText(k.body), when: currencyText(k.when) })),
  }), [currencyText])
}
