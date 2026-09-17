'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { queryKeys } from '@/lib/query-keys'
import type { Page } from '@/lib/contracts'

import { fetchMessagePage } from '../api/client'
import type { Message } from '../schemas'

type MessageCache = { pages: Page<Message>[]; pageParams: (string | null)[] }

/**
 * A thread, read from its end.
 *
 * Pages arrive newest-first because that is the screenful the user needs before anything else,
 * and are flipped here so the rendered list runs chronologically.
 *
 * The deduplication is belt and braces now rather than a workaround. The cursor is a keyset
 * position on `(created_at, id)`, so a message arriving while the user pages backwards no longer
 * shifts every later page by one the way an offset did — the boundary is a fixed point in the
 * ordering. What remains possible is the same message reaching the cache twice by two routes: a
 * page fetch and the live insert below. The Set costs nothing and closes it.
 */
export function useMessages(conversationId: number) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: queryKeys.messages.list(conversationId),
    queryFn: ({ pageParam, signal }) => fetchMessagePage(conversationId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const messages = useMemo(() => {
    const seen = new Set<number>()
    const ordered: Message[] = []

    for (const page of query.data?.pages ?? []) {
      for (const message of page.data) {
        if (seen.has(message.id)) continue
        seen.add(message.id)
        ordered.push(message)
      }
    }

    return ordered.toReversed()
  }, [query.data])

  /** Drops a server-confirmed message straight into the newest page, no round trip. */
  const insert = useCallback(
    (message: Message) => {
      queryClient.setQueryData<MessageCache>(queryKeys.messages.list(conversationId), (cache) => {
        if (!cache || cache.pages.length === 0) return cache
        const [newest, ...rest] = cache.pages
        if (!newest || newest.data.some((item) => item.id === message.id)) return cache
        return { ...cache, pages: [{ ...newest, data: [message, ...newest.data] }, ...rest] }
      })
    },
    [conversationId, queryClient]
  )

  /**
   * Polls only the newest page instead of invalidating the query.
   *
   * Invalidating an infinite query refetches every page that is currently loaded. On a thread
   * where the user has scrolled back through ten pages, a five-second poll would refetch ten
   * pages every five seconds to discover one new message.
   */
  const refreshLatest = useCallback(async () => {
    const page = await fetchMessagePage(conversationId, null)
    for (const message of page.data.toReversed()) insert(message)
  }, [conversationId, insert])

  return { ...query, messages, insert, refreshLatest }
}
