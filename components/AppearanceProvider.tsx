'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
export type Density = 'comfortable' | 'compact'

interface AppearanceValue {
  theme: Theme
  density: Density
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
}

const AppearanceContext = createContext<AppearanceValue | null>(null)

function readTheme(): Theme {
  const saved = typeof window === 'undefined' ? null : window.localStorage.getItem('mc-theme')
  return saved === 'light' || saved === 'dark' ? saved : 'dark'
}

function readDensity(): Density {
  const saved = typeof window === 'undefined' ? null : window.localStorage.getItem('mc-density')
  return saved === 'compact' ? 'compact' : 'comfortable'
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [density, setDensity] = useState<Density>(readDensity)

  useEffect(() => {
    window.localStorage.setItem('mc-theme', theme)
  }, [theme])

  useEffect(() => {
    window.localStorage.setItem('mc-density', density)
  }, [density])

  return (
    <AppearanceContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance(): AppearanceValue {
  const value = useContext(AppearanceContext)
  if (!value) throw new Error('useAppearance must be used within AppearanceProvider')
  return value
}
