import type { BudgetRow } from '@/src/types'

export class BudgetWriteError extends Error {
  constructor(readonly status: number, message: string, readonly current?: BudgetRow) {
    super(message)
    this.name = 'BudgetWriteError'
  }
}
