import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBillScan, getBillScans, saveBillScan } from '@/src/api/bills'

const key = ['bill-scans'] as const

export function useSaveBillScan() {
  const qc = useQueryClient()
  // Web can scan from any page, including while the history list is cached.
  return useMutation({ mutationFn: saveBillScan, onSuccess: () => qc.invalidateQueries({ queryKey: key }) })
}

export function useBillScans() {
  return useQuery({ queryKey: key, queryFn: getBillScans, staleTime: 30_000 })
}

export function useBillScan(id: string | undefined) {
  return useQuery({
    queryKey: [...key, id],
    queryFn: () => getBillScan(id as string),
    enabled: !!id,
  })
}
