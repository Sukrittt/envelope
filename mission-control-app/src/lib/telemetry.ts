export type TelemetryEvent = 'nav_click' | 'page_view' | 'quick_action_used' | 'theme_changed'

export function trackEvent(event: TelemetryEvent, payload: Record<string, string | number | boolean>) {
  // Placeholder sink for MVP instrumentation.
  // Replace with analytics SDK when available.
  console.info(`[telemetry] ${event}`, payload)
}
