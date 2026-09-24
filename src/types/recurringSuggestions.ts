import type { RecurringExpenseInput } from '../api/recurringExpenses'
export type ScanMonths = 1 | 3 | 6 | 12
export type RecurringSuggestion = {
  id: string
  kind: 'subscription' | 'other_recurring'
  dates: string[]
  occurrences: number
  variableAmount: boolean
  input: RecurringExpenseInput
}
export type RecurringScan = {
  suggestions: RecurringSuggestion[]
  scannedAt: string | null
  windowStart: string
  windowEnd: string
  remaining: number
  stale?: boolean
  failed?: number
}
