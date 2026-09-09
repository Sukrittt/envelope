import { useQuery } from '@tanstack/react-query'
import { getCategoryMap } from '@/src/api/categoryMap'

export function useCategoryMap() {
  return useQuery({ queryKey: ['category-map'], queryFn: getCategoryMap, staleTime: 60_000 })
}
