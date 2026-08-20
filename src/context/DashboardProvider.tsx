import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getDashboardData } from '../services/dashboardService'
import type { DashboardData } from '../types'
import { DashboardContext } from './dashboardContext'

// Pages that exist outside the "logged in and onboarded" app proper — never
// bounce these to /onboarding even if the onboarding check would otherwise fire.
const ONBOARDING_EXEMPT_PATHS = ['/sign-in', '/email', '/code', '/onboarding']

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pathname = usePathname() ?? ''
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const next = await getDashboardData()
      setData(next)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Single app-mount onboarding gate: once, not per page. Skipped on the
  // auth/onboarding pages themselves so it can't loop.
  useEffect(() => {
    if (ONBOARDING_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return

    void (async () => {
      try {
        const res = await fetch('/api/user')
        if (!res.ok) return
        const user = await res.json()
        if (!user.onboardedAt) router.push('/onboarding')
      } catch {
        // Network hiccup — not worth blocking the app over, next mount tries again.
      }
    })()
    // Intentionally runs once per mount, not per pathname change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({ data, loading, error, reload: load }),
    [data, loading, error, load],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
