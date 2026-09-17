'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { queryKeys } from '@/lib/query-keys'

import { fetchMessagePage } from '../api/client'

/**
 * Warms the newest page of a thread. Exposed through the feature's barrel because the
 * conversation list is what knows when the user is about to open one.
 */
export function usePrefetchThread() {
  const queryClient = useQueryClient()

  return useCallback(
    (conversationId: number) => {
      void queryClient.prefetchInfiniteQuery({
        queryKey: queryKeys.messages.list(conversationId),
        queryFn: ({ pageParam }) => fetchMessagePage(conversationId, pageParam as string | null),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // Only the newest page. Prefetching history the user has not asked for would spend their
        // bandwidth on a thread they may never open.
        pages: 1,
        staleTime: 30_000,
      })
    },
    [queryClient]
  )
}
