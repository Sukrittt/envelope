/** Stable semantic chart palette shared by every insights primitive.
 * Order matches Mobile's CHART_COLOR_CYCLE index-for-index (blue, mint,
 * violet, accent, coral, warn) so the same category lands on the same
 * color on both apps. */
export const CHART_COLORS = [
  'var(--blue)',
  'var(--mint)',
  'var(--violet)',
  'var(--gold)',
  'var(--coral)',
  'var(--warn)',
] as const
