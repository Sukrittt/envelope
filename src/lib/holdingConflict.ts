import type { HoldingRow } from '@/src/types'

export class HoldingWriteError extends Error {
  constructor(readonly status: number, message: string, readonly current?: HoldingRow) {
    super(message)
    this.name = 'HoldingWriteError'
  }
}

export type HoldingDraft = { isRecurring: boolean; recurringAmount: string }

export function holdingDraft(row: Pick<HoldingRow, 'is_recurring' | 'recurring_amount'>): HoldingDraft {
  return {
    isRecurring: row.is_recurring === 'true',
    recurringAmount: row.recurring_amount || '',
  }
}

/** Recurrence is one logical setting: never rebase an amount separately from its switch. */
export function holdingChanges(original: HoldingDraft, draft: HoldingDraft) {
  if (draft.isRecurring === original.isRecurring && draft.recurringAmount === original.recurringAmount) return {}
  return {
    is_recurring: draft.isRecurring,
    ...(draft.isRecurring ? { recurring_amount: draft.recurringAmount.trim() } : {}),
  }
}

/** Preserve the complete user-edited recurrence pair; otherwise adopt the latest pair. */
export function rebaseHoldingDraft(original: HoldingDraft, draft: HoldingDraft, latest: HoldingRow): HoldingDraft {
  return Object.keys(holdingChanges(original, draft)).length > 0 ? draft : holdingDraft(latest)
}
