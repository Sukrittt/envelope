/** Shared INR currency formatter — shows the exact value (2 decimals when non-zero,
 *  omitted for whole rupees) instead of rounding, e.g. 78.84 -> "₹78.84", 79 -> "₹79". */
export function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const [intStr, decStr] = abs.toFixed(2).split('.')
  const isZero = intStr === '0' && decStr === '00'
  const sign = value < 0 && !isZero ? '-' : ''
  const decimals = decStr === '00' ? '' : `.${decStr}`
  return `${sign}₹${Number(intStr).toLocaleString('en-IN')}${decimals}`
}
