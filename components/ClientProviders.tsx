'use client'

import type { ReactNode } from 'react'
import { DashboardProvider } from '../src/context/DashboardProvider'
import { AuthGate } from '../src/components/AuthGate'
import { AppShell } from './AppShell'
import { AppearanceProvider } from './AppearanceProvider'

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AppearanceProvider>
      <DashboardProvider>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </DashboardProvider>
    </AppearanceProvider>
  )
}
