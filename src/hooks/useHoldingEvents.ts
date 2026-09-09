import { useQuery } from '@tanstack/react-query'
import { getHoldingEvents } from '@/src/api/holdingEvents'

export function useHoldingEvents() {
  return useQuery({ queryKey: ['holding-events'], queryFn: getHoldingEvents, staleTime: 30_000 })
}
