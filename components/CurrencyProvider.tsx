'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from '@workos-inc/authkit-nextjs/components'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser } from '@/src/api/account'
import { CurrencyScope } from '@/src/context/CurrencyContext'

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const previous = useRef(user?.id)
  useEffect(() => {
    if (previous.current !== user?.id) qc.removeQueries({ queryKey: ['user'] })
    previous.current = user?.id
  }, [user?.id, qc])
  const profile = useQuery({ queryKey: ['user'], queryFn: getUser, enabled: !!user, staleTime: 30_000, refetchOnWindowFocus: 'always' })
  return <CurrencyScope code={user && profile.data?._id === user.id ? profile.data.currencyCode ?? 'INR' : 'INR'}>{children}</CurrencyScope>
}
