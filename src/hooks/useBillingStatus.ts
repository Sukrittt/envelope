'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getBillingStatus, syncBilling, type BillingStatus } from '@/src/api/billing'

export const billingKey = ['billing-status'] as const

/**
 * The account's subscription state. Twin of Mobile/src/hooks/useBillingStatus.
 *
 * The web app never runs Play checkout, so there is no purchase to react to
 * here — this exists to recognize an entitlement bought on Android, and to
 * show the trial countdown. `refetchOnWindowFocus` covers the realistic case:
 * the user buys on their phone, comes back to this tab, and expects the app
 * to have caught up.
 */
export function useBillingStatus() {
  return useQuery({
    queryKey: billingKey,
    queryFn: getBillingStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * "Refresh subscription status" — for someone who just paid in the Android
 * app and does not want to wait for the webhook to land.
 */
export function useSyncBilling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: syncBilling,
    onSuccess: (status: BillingStatus) => {
      qc.setQueryData(billingKey, status)
      // Access just changed — every screen that was showing restricted or
      // stale content needs to refetch what it could not load before.
      if (status.allowed) void qc.invalidateQueries()
    },
  })
}

/**
 * Whether normal app features should be usable right now.
 *
 * Unknown (still loading, or the request failed) is treated as allowed. The
 * server enforces this independently on every route, so being wrong here
 * costs a 402 on the next request — whereas failing closed would lock out a
 * paying user over one flaky fetch.
 */
export function useAccessAllowed(): boolean {
  const { data } = useBillingStatus()
  return data?.allowed ?? true
}
