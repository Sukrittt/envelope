'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createCurrencyFormat } from '@/src/lib/currencies'

const CurrencyContext = createContext(createCurrencyFormat())
export function CurrencyScope({ code, children }: { code: string; children: ReactNode }) {
  const value = useMemo(() => createCurrencyFormat(code), [code])
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}
export function useCurrency() { return useContext(CurrencyContext) }
