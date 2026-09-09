/** One reviewable line on the bill-scan review screen. `divisor: null` = skipped (not mine at all). */
export type ScanItem = { name: string; price: number; divisor: number | null }

/** Round to 2dp, avoiding the classic *100 float wobble (1.005 -> 1.00). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Sum of price/divisor across every non-skipped item, rounded to 2dp (paisa). */
export function computeShare(items: ScanItem[]): number {
  const total = items.reduce((sum, it) => (it.divisor ? sum + it.price / it.divisor : sum), 0)
  return round2(total)
}

/**
 * total - sum(item prices), 2dp rounded. Line items on a delivery-app cart
 * rarely sum to the printed total (delivery fee, small-cart fee, a discount,
 * rounding) — this is that gap. Positive = bill exceeds items (a fee).
 * Negative = a discount. Callers should treat anything under a paisa as
 * rounding noise, not a real charge.
 */
export function feeDiff(total: number, items: { price: number }[]): number {
  const sum = items.reduce((s, it) => s + it.price, 0)
  return round2(total - sum)
}

const FEE_KEYWORDS = ['fee', 'discount', 'offer', 'coupon', 'charge', 'tip']
const FEE_PATTERN = new RegExp(`\\b(?:${FEE_KEYWORDS.join('|')})\\b`, 'i')

/** True if an item's name contains a fee/discount keyword as a complete word. */
export function isFeeLine(name: string): boolean {
  return FEE_PATTERN.test(name)
}

/** Groups non-skipped items by their divisor, ascending, for the confirm screen's breakdown. */
export function groupByDivisor(items: ScanItem[]): { divisor: number; count: number; gross: number; share: number }[] {
  const byDiv = new Map<number, { divisor: number; count: number; gross: number; share: number }>()
  for (const it of items) {
    if (!it.divisor) continue
    const bucket = byDiv.get(it.divisor) ?? { divisor: it.divisor, count: 0, gross: 0, share: 0 }
    bucket.count += 1
    bucket.gross += it.price
    bucket.share += it.price / it.divisor
    byDiv.set(it.divisor, bucket)
  }
  return [...byDiv.values()].sort((a, b) => a.divisor - b.divisor).map((b) => ({ ...b, share: round2(b.share) }))
}
