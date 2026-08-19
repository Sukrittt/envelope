'use client'

import type { ReactNode } from 'react'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { DashboardProvider } from '../src/context/DashboardProvider'
import { AuthGate } from '../src/components/AuthGate'
import { AppShell } from './AppShell'
import { AppearanceProvider } from './AppearanceProvider'

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <AppearanceProvider>
        <DashboardProvider>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </DashboardProvider>
      </AppearanceProvider>
    </AuthKitProvider>
  )
}
