import { it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { getUser, updateUser, restoreAccount, type UserProfile } from '@/src/api/account'
import { useUser, useUpdateUser, useRestoreAccount, userKey } from './useUser'

vi.mock('@/src/api/account', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  restoreAccount: vi.fn(),
  getSessions: vi.fn(),
  getIdentityProviders: vi.fn(),
}))

function wrapper(queryClient: QueryClient) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

it('useUser resolves the profile from the API', async () => {
  ;(getUser as Mock).mockResolvedValue({ email: 'a@b.com', emailVerified: true })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useUser(), { wrapper: wrapper(queryClient) })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(result.current.data?.email).toBe('a@b.com')
})

it('useUpdateUser writes the server response into the cache on success, without a refetch', async () => {
  ;(updateUser as Mock).mockResolvedValue({ email: 'a@b.com', emailVerified: true, name: 'Sukrit' })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ name: 'Sukrit' })

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(queryClient.getQueryData(userKey)).toEqual({ email: 'a@b.com', emailVerified: true, name: 'Sukrit' })
  expect(invalidateSpy).not.toHaveBeenCalled()
})

it('applies the patch optimistically before the API call resolves', async () => {
  // Held pending so the assertion below observes the optimistic write, not
  // the post-settle state — resolved at the end so nothing leaks a pending handle.
  let resolveUpdate: () => void = () => {}
  ;(updateUser as Mock).mockImplementation(
    () => new Promise<UserProfile>((resolve) => { resolveUpdate = () => resolve({ email: 'a@b.com', emailVerified: true, notifyCadence: 'daily' }) }),
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(userKey, { email: 'a@b.com', emailVerified: true, notifyCadence: 'off' })
  const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ notifyCadence: 'daily' })

  await waitFor(() => {
    const data = queryClient.getQueryData<UserProfile>(userKey)
    expect(data?.notifyCadence).toBe('daily')
  })

  resolveUpdate()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
})

it('rolls back the optimistic patch when the API call errors', async () => {
  ;(updateUser as Mock).mockRejectedValue(new Error('network error'))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(userKey, { email: 'a@b.com', emailVerified: true, notifyCadence: 'off' })
  const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapper(queryClient) })

  result.current.mutate({ notifyCadence: 'daily' })

  await waitFor(() => expect(result.current.isError).toBe(true))
  const data = queryClient.getQueryData<UserProfile>(userKey)
  expect(data?.notifyCadence).toBe('off')
})

it('useRestoreAccount invalidates every query on success', async () => {
  ;(restoreAccount as Mock).mockResolvedValue(undefined)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const { result } = renderHook(() => useRestoreAccount(), { wrapper: wrapper(queryClient) })

  result.current.mutate()

  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(invalidateSpy).toHaveBeenCalled()
})
