// Per-category budget-alert threshold constants. Mirrors Web's
// lib/notifications/rules.ts DEFAULT_ALERT_PCTS — a category with no
// alertPcts of its own is evaluated against this set server-side, so this
// copy exists purely to display the same numbers client-side (onboarding
// hint, the envelopes edit sheet's initial selection).
export const DEFAULT_ALERT_PCTS = [50, 90, 100]
export const ALERT_PRESET_PCTS = [25, 50, 75, 90, 100]
export const MAX_ALERT_PCTS = 5
