'use client'

import type { ReactNode } from 'react'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { OnboardingGate } from './OnboardingGate'
import { QueryProvider } from './QueryProvider'
import { AppShell } from './AppShell'
import { AppearanceProvider } from './AppearanceProvider'
import { MoneyBrainProvider } from './MoneyBrainProvider'

// No AuthGate any more: middleware.ts now redirects any signed-out visitor to
// /sign-in before this ever mounts, so there is nothing left to gate here.
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
