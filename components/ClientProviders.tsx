'use client'

import type { ReactNode } from 'react'
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components'
import { OnboardingGate } from './OnboardingGate'
import { QueryProvider } from './QueryProvider'
import { AppShell } from './AppShell'
import { AppearanceProvider } from './AppearanceProvider'

// No AuthGate any more: middleware.ts now redirects any signed-out visitor to
// /sign-in before this ever mounts, so there is nothing left to gate here.
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthKitProvider>
      <QueryProvider>
        <AppearanceProvider>
          <OnboardingGate>
            <AppShell>{children}</AppShell>
          </OnboardingGate>
        </AppearanceProvider>
      </QueryProvider>
    </AuthKitProvider>
  )
}
