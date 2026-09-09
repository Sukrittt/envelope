import { useQuery } from '@tanstack/react-query'
import { fetchBrief } from '@/src/api/ai'

const key = ['ai-brief'] as const

export function useMoneyBrief() {
  return useQuery({ queryKey: key, queryFn: fetchBrief, staleTime: 15 * 60_000, retry: 1 })
}
