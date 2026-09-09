import { useQuery } from '@tanstack/react-query'
import { listChatSessions } from '@/src/api/ai'

const HISTORY_LIMIT = 10

/** Only fetches while `enabled` — the history list is opened on demand, not on every chat mount. */
export function useChatSessions(enabled: boolean, params: { page: number; query: string }) {
  return useQuery({
    queryKey: ['chatSessions', params.page, params.query] as const,
    queryFn: () => listChatSessions({ page: params.page, limit: HISTORY_LIMIT, q: params.query || undefined }),
    enabled,
    staleTime: 10_000,
  })
}

/** Cheapest possible call (limit: 1) just to read `total` for the header count badge. Always enabled. */
export function useChatSessionsCount() {
  return useQuery({
    queryKey: ['chatSessionsCount'] as const,
    queryFn: () => listChatSessions({ page: 1, limit: 1 }),
    staleTime: 10_000,
    select: (data) => data.total,
  })
}
