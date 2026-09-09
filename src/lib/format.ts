// Indian digit grouping (last 3 digits, then pairs), written by hand instead
// of `toLocaleString('en-IN')` since Hermes's ICU/Intl support varies by build
// and this is money math we need right everywhere.
function groupIndian(intStr: string): string {
  const last3 = intStr.slice(-3)
  const rest = intStr.slice(0, -3)
  return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3
}

export function formatINR(value: number): string {
  const abs = Math.abs(value)
  const [intStr, decStr] = abs.toFixed(2).split('.')
  const isZero = intStr === '0' && decStr === '00'
  const sign = value < 0 && !isZero ? '-' : ''
  const decimals = decStr === '00' ? '' : `.${decStr}`
  return `${sign}₹${groupIndian(intStr)}${decimals}`
}

/** Pass hide=true (the "hide amounts" toggle) to mask the value instead of formatting it. */
export function formatCurrency(value: number, hide = false): string {
  return hide ? '₹••••' : formatINR(value)
}

// Mirrors what the numpad's raw string looks like mid-entry (a trailing "."
// or trailing zeros formatINR would normally round away) so the amount on
// screen never drops a digit the user just typed.
export function formatAmountInput(raw: string): string {
  if (raw === '') return '₹0'
  const [intPart, decPart] = raw.split('.')
  const grouped = groupIndian(intPart || '0')
  return decPart === undefined ? `₹${grouped}` : `₹${grouped}.${decPart}`
}

/** e.g. "2 hours ago" — used by OfflineScreen's "last synced" caption. */
export function formatRelativeTime(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** e.g. "12 Aug, 3:45 PM" — used by Investments' holding rows and event history. */
export function formatDateTime(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  const hours24 = d.getHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 < 12 ? 'AM' : 'PM'
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hours12}:${minutes} ${ampm}`
}

/** e.g. "12 Aug 2026" — date-only, no time. */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Whole days from now until `ts`, floored at 0 — used for "purges in N days" archive countdowns. */
export function daysUntil(ts: string): number {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

/** e.g. "27 Aug '26, 1:24 am" — the full stamp shown on the post-log confirmation,
 *  where the year matters because the date can be back-dated by the entry screen. */
export function formatDateTimeLong(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  const hours24 = d.getHours()
  const hours12 = hours24 % 12 || 12
  const ampm = hours24 < 12 ? 'am' : 'pm'
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} '${year}, ${hours12}:${minutes} ${ampm}`
}
