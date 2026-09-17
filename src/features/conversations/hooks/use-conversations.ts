'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Conversation, Page } from '@/lib/contracts'

import { queryKeys } from '@/lib/query-keys'

import {
  createConversationRequest,
  fetchContacts,
  fetchConversationPage,
  fetchProducts,
  markConversationReadRequest,
} from '../api/client'

type ConversationCache = { pages: Page<Conversation>[]; pageParams: (string | null)[] }

/**
 * Applies a patch to one conversation wherever it is cached in a list.
 *
 * Matched on `lists()` rather than `root`, and that is the whole point of this function existing.
 * `root` also matches `conversations.detail`, whose cache is a single conversation and has no
 * `pages` to map over — so the updater threw a TypeError the moment a thread page was open, which
 * is the only place it is ever called from. Inside `onMutate` that throw is silent and expensive:
 * React Query treats it as the mutation failing before it started, so `mutationFn` never runs. The
 * read receipt was never sent, the badge cleared optimistically anyway, and the unread count came
 * back on the next reload. Keeping every list write behind this one helper is what stops the same
 * mismatch being reintroduced a third time.
 */
function patchCachedConversation(
  queryClient: QueryClient,
  conversationId: number,
  patch: Partial<Conversation>
) {
  queryClient.setQueriesData<ConversationCache>(
    { queryKey: queryKeys.conversations.lists() },
    (cache) =>
      cache
        ? {
            ...cache,
            pages: cache.pages.map((page) => ({
              ...page,
              data: page.data.map((conversation) =>
                conversation.id === conversationId ? { ...conversation, ...patch } : conversation
              ),
            })),
          }
        : cache
  )
}

/**
 * The list is an infinite query even though the seeded corpus holds sixty threads. A messaging
 * inbox is unbounded by nature, and the difference between "paginated" and "not paginated" is
 * not a refactor anyone wants to do later against a live cache.
 *
 * The search term is part of the query key, so each term gets its own cached, independently
 * paginated result rather than the pages of one search leaking into another.
 */
export function useConversations(search?: string) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.list(search),
    queryFn: ({ pageParam, signal }) => fetchConversationPage(pageParam, search, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  /*
   * Flattened once per data change rather than on every render, and deduplicated by id.
   *
   * The cursor is a keyset position now, so a page boundary is stable under concurrent writes in
   * a way an offset never was. But a conversation whose activity changes between two fetches can
   * still move across a boundary, because the sort key is the value being updated. Keeping the
   * guard costs a Set and removes the one case where a row would render twice.
   */
  const conversations = useMemo(() => {
    const seen = new Set<number>()
    const rows: Conversation[] = []

    for (const page of query.data?.pages ?? []) {
      for (const conversation of page.data) {
        if (seen.has(conversation.id)) continue
        seen.add(conversation.id)
        rows.push(conversation)
      }
    }

    return rows
  }, [query.data])

  return { ...query, conversations }
}

export function useContacts(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.contacts(),
    queryFn: ({ signal }) => fetchContacts(signal),
    // The picker is behind a dialog; fetching the directory before it opens is wasted bandwidth.
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useProducts(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.products(),
    queryFn: ({ signal }) => fetchProducts(signal),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createConversationRequest,
    onSuccess: (conversation) => {
      // Seed the detail cache so the thread page renders its header immediately on navigation
      // instead of showing a skeleton for data already in hand.
      queryClient.setQueryData(queryKeys.conversations.detail(conversation.id), conversation)
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.root })
    },
  })
}

/**
 * Clears the unread badge as soon as the thread is on screen.
 *
 * Optimistic, and deliberately not rolled back on failure. The badge is a convenience, and a
 * count that reappears a second after the user has plainly read the messages reads as a bug
 * rather than as honesty about a failed request. The next list refetch corrects it either way.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markConversationReadRequest,
    onMutate: (conversationId: number) => {
      patchCachedConversation(queryClient, conversationId, { unreadCount: 0 })
    },
  })
}

/**
 * Moves a conversation to the top of the cached list after a send.
 *
 * Both halves are needed. Writing the new timestamp updates the relative label immediately, but
 * the rendered order comes from the order of the items in the pages, so rewriting a value in
 * place leaves the row exactly where it was — which reads as a bug. The refetch is what actually
 * reorders; the optimistic write is what stops the label flickering while it happens.
 */
export function useBumpConversation() {
  const queryClient = useQueryClient()

  return (conversationId: number, timestamp: number, preview: string) => {
    patchCachedConversation(queryClient, conversationId, {
      lastMessageTimestamp: timestamp,
      preview,
    })

    // The invalidation stays on `root`: a refetch is the right answer for the detail entry too.
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.root })
  }
}
