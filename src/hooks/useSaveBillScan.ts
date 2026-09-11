import { useMutation } from '@tanstack/react-query'
import { saveBillScan } from '@/src/api/bills'

/** No cache invalidation — nothing reads bill_scans yet (history screen is a separate task). */
export function useSaveBillScan() {
  return useMutation({ mutationFn: saveBillScan })
}
