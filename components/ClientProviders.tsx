'use client'

import type { ReactNode } from 'react'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { OnboardingGate } from './OnboardingGate'
import { QueryProvider } from './QueryProvider'
import { AppShell } from './AppShell'
import { AppearanceProvider } from './AppearanceProvider'
import { MoneyBrainProvider } from './MoneyBrainProvider'

// No AuthGate: signed-out visitors use the API's read-only demo account, while
// AuthKitProvider upgrades the same public pages when a real session exists.
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <QueryProvider>
        <AppearanceProvider>
          <MoneyBrainProvider>
            <OnboardingGate>
              <AppShell>{children}</AppShell>
            </OnboardingGate>
          </MoneyBrainProvider>
        </AppearanceProvider>
      </QueryProvider>
    </AuthKitProvider>
  )
}
