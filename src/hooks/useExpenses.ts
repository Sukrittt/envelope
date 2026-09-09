import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteExpense,
  getExpenses,
  mintExpensePayload,
  postExpensePayload,
  updateExpense,
  type NewExpenseRow,
} from '@/src/api/expenses'
import { budgetsKey } from '@/src/hooks/useBudgets'
import { track } from '@/src/lib/analytics'

const key = ['expenses'] as const
// Money Brain's brief is computed from expenses too, but keyed separately —
// an edit here must bust it or it shows stale numbers for up to its 15min staleTime.
const briefKey = ['ai-brief'] as const
// The autosuggest word->category map is built from expense item/category text —
// bust it too or it shows stale suggestions for up to its 60s staleTime.
const categoryMapKey = ['category-map'] as const

export function useExpenses() {
  return useQuery({ queryKey: key, queryFn: getExpenses, staleTime: 30_000 })
}

export type AddExpenseResult = { id?: string; timestamp?: string; clientId: string; pending: boolean }

export function useAddExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: NewExpenseRow): Promise<AddExpenseResult> => {
      const payload = mintExpensePayload(row)
      // Mobile catches a transport failure here and queues the payload for its
      // offline flush. Web has no queue (offline logging is out of parity
      // scope), so a failed post just throws and the caller shows an error.
      // `pending` stays in the result so callers read the same shape as their
      // mobile twins; it is never true here.
      const result = await postExpensePayload(payload)
      return { id: result.id, timestamp: result.timestamp, clientId: payload.client_id, pending: false }
    },
    onSuccess: (_data, row) => {
      // Both the manual screen and scan-bill's confirm land here, which is the
      // point: one event for "an expense got saved". $screen_name splits them
      // after the fact. No amount and no item name, only the two fields worth
      // segmenting on.
      track('expense_logged', {
        category: row.category,
        payment_method: row.payment_method ?? 'unknown',
      })
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // A credit-card expense add/edit/delete also rebalances the Credit
      // Card envelope server-side — bust budgets too or Envelopes shows a
      // stale balance for up to its 30s staleTime.
      qc.invalidateQueries({ queryKey: budgetsKey })
      qc.invalidateQueries({ queryKey: categoryMapKey })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: {
      id?: string
      timestamp: string
      item: string
      amountInr: number
      updates: Parameters<typeof updateExpense>[4]
    }) => updateExpense(params.id, params.timestamp, params.item, params.amountInr, params.updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // See useAddExpense — this can also rebalance the CC envelope.
      qc.invalidateQueries({ queryKey: budgetsKey })
      qc.invalidateQueries({ queryKey: categoryMapKey })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { id?: string; timestamp: string; item: string; amountInr: number }) =>
      deleteExpense(params.id, params.timestamp, params.item, params.amountInr),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: briefKey })
      // See useAddExpense — this can also rebalance the CC envelope.
      qc.invalidateQueries({ queryKey: budgetsKey })
      qc.invalidateQueries({ queryKey: categoryMapKey })
    },
  })
}
