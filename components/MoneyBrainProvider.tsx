'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { MoneyBrainDrawer } from '@/src/components/MoneyBrainDrawer'

interface MoneyBrainContextValue {
  openMoneyBrain: (sessionId?: string | null) => void
  closeMoneyBrain: () => void
  isMoneyBrainOpen: boolean
}

const MoneyBrainContext = createContext<MoneyBrainContextValue | null>(null)

export function MoneyBrainProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ key: number; sessionId: string | null } | null>(null)

  const openMoneyBrain = useCallback((sessionId: string | null = null) => {
    setRequest({ key: Date.now(), sessionId })
  }, [])
  const closeMoneyBrain = useCallback(() => setRequest(null), [])
  const value = useMemo(
    () => ({ openMoneyBrain, closeMoneyBrain, isMoneyBrainOpen: request !== null }),
    [closeMoneyBrain, openMoneyBrain, request],
  )

  return (
    <MoneyBrainContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {request && (
          <MoneyBrainDrawer
            key={request.key}
            initialSessionId={request.sessionId}
            onClose={closeMoneyBrain}
          />
        )}
      </AnimatePresence>
    </MoneyBrainContext.Provider>
  )
}

export function useMoneyBrain() {
  const value = useContext(MoneyBrainContext)
  if (!value) throw new Error('useMoneyBrain must be used inside MoneyBrainProvider')
  return value
}
