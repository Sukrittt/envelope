import { useCurrency } from '@/src/context/CurrencyContext'
import { useQuery } from '@tanstack/react-query'
import { fetchBrief } from '@/src/api/ai'

const key = ['ai-brief'] as const

export function useMoneyBrief({ enabled = true }: { enabled?: boolean } = {}) {
  const { currencyCode } = useCurrency()
  return useQuery({ queryKey: [...key, currencyCode], queryFn: fetchBrief, staleTime: 15 * 60_000, retry: 1, enabled })
}
