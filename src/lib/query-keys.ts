/**
 * Every key in the application is built here.
 *
 * Keys are how the cache, the optimistic updates and the invalidations find each other.
 * Scattering the literals is how a mutation quietly stops refreshing a list, which nobody
 * notices until a user reports stale data — and the fix is then spread across as many files as
 * the literals were.
 *
 * `conversations.root` is what mutations invalidate, so it covers every cached search term as
 * well as the unfiltered list. Invalidating only the unfiltered list would leave a user who had
 * typed in the search box looking at a stale result after sending a message.
 */
export const queryKeys = {
  conversations: {
    root: ['conversations'] as const,
    /**
     * Every cached list, whatever the search term — and nothing else.
     *
     * Deliberately narrower than `root`, which also matches `detail`. Invalidation can afford to
     * be broad, because a refetch is correct for any of them; an optimistic write cannot, because
     * a list cache and a detail cache do not have the same shape.
     */
    lists: () => [...queryKeys.conversations.root, 'list'] as const,
    list: (search?: string) => [...queryKeys.conversations.lists(), search ?? ''] as const,
    detail: (conversationId: number) =>
      [...queryKeys.conversations.root, 'detail', conversationId] as const,
  },
  messages: {
    root: ['messages'] as const,
    list: (conversationId: number) => [...queryKeys.messages.root, 'list', conversationId] as const,
  },
  contacts: () => ['contacts'] as const,
  products: () => ['products'] as const,
} as const
