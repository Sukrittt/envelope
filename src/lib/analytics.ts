// Product analytics. Twin of Mobile/src/lib/analytics.ts, minus a backend.
//
// Mobile sends these to PostHog. Web has no analytics SDK wired up yet, so
// this is a sink with the same surface: the hooks in src/hooks/ call track()
// in their mutation success handlers exactly as their mobile twins do, and
// stay diffable against them. Point `emit` at a real client when web analytics
// is actually a decision someone has made — the call sites need no edit.

/**
 * Every product event the app sends. A union rather than a bare string so a
 * typo becomes a type error instead of a junk event nobody notices for a
 * month. Add a name here first, then call track(). Kept identical to mobile's
 * union so one event means one thing across both apps.
 */
export type AppEvent =
  | 'expense_logged'
  | 'bill_scanned'
  | 'money_moved'
  | 'envelope_created'
  | 'money_brain_query'
  | 'onboarding_completed'
  | 'feedback_sent'

/**
 * Properties are for segmenting, never for identifying. Amounts, item names
 * and merchant strings stay out: they are the sensitive half of this app's
 * data and analytics is the wrong place for them.
 */
export function track(event: AppEvent, properties?: Record<string, string | number | boolean>): void {
  if (process.env.NODE_ENV === 'development') {
    console.info(`[analytics] ${event}`, properties ?? {})
  }
}
