import { createContext } from 'react'
import type { DashboardData } from '../types'

export interface DashboardContextValue {
  data: DashboardData | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export const DashboardContext = createContext<DashboardContextValue | undefined>(undefined)
