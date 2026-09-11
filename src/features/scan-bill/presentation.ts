// Twin of Mobile/src/features/scan-bill/presentation.ts, minus the reveal
// timings: web staggers these with CSS animation-delay instead.
export const DIVISORS = [1, 2, 3, 4];
export const PEOPLE_COUNTS = [2, 3, 4, 5];

export function splitLabel(divisor: number | null): string {
  if (divisor === null) return "skip";
  if (divisor === 1) return "Mine";
  return `÷${divisor}`;
}
