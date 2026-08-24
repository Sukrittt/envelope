/**
 * Prefix a leading =, +, -, @, tab, or CR with a `'` so spreadsheet apps
 * (Excel, Google Sheets) treat the cell as text instead of a formula —
 * without this, an expense item like `=HYPERLINK(...)` executes as a
 * formula the moment the export is opened. The `'` itself needs no escaping;
 * spreadsheet apps strip it as a text-cell marker.
 */
export function defangFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/** Quote a CSV field only when it contains a comma, quote, or newline. */
export function csvField(value: string): string {
  const defanged = defangFormula(value)
  return /[",\n]/.test(defanged) ? `"${defanged.replace(/"/g, '""')}"` : defanged
}

export function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => csvField(row[h] ?? '')).join(','))
  return lines.join('\n')
}
