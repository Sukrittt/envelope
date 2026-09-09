import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * QueryClientProvider wrapper for `renderHook`. Twin of the inline wrapper each
 * of Mobile's hook tests defines; retries are off so a rejected queryFn
 * surfaces as an error state immediately instead of after a backoff.
 */
export function queryWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}
