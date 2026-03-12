import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getDashboardData } from '../services/dashboardService'
import type { DashboardData } from '../types'
import { DashboardContext } from './dashboardContext'

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const value = useMemo(
    () => ({ data, loading, error, reload: load }),
    [data, loading, error, load],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
