export interface BudgetRow {
  month: string
  category: string
  assigned: number
  rolledOver: number
}

export interface Envelope {
  category: string
  assigned: number
  spent: number
  available: number
  rolledOver: number
  isOverspent: boolean
  spentPct: number
  isCreditCardPayment?: boolean
  lastSpentDate?: string
}

export interface EnvelopeState {
  month: string
  income: number
  totalAssigned: number
  totalSpent: number
  readyToAssign: number
  envelopes: Envelope[]
  isOverAssigned: boolean
}
