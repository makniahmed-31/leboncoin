import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { queryKeys } from '@/lib/query-keys'
import { makeConversation } from '@/test/factories'
import { server } from '@/test/msw-server'

import { useBumpConversation, useMarkConversationRead } from './use-conversations'

const CONVERSATION_ID = 21

type ListCache = {
  pages: { data: { id: number; unreadCount: number; preview?: string }[] }[]
}

/**
 * A local client rather than `renderWithProviders`, for one reason: the shared one runs with
 * `gcTime: 0`, which collects a cache entry that has no observer the moment it is written. These
 * tests seed two entries by hand and never subscribe to them, so they would be swept away before
 * the mutation ever looked for them — and everything below would pass for the wrong reason.
 */
function renderProbe(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })

  /*
   * The cache as a thread page leaves it: the list, plus the detail entry the page seeds so its
   * header renders without a second round trip.
   *
   * That second entry is the point of these tests. Both writers find their conversation through a
   * key prefix, and `conversations.root` matches the detail entry as well as the list — but only
   * one of the two shapes has `pages` to map over. Seeded with a list alone, a writer that matches
   * too broadly still passes; it takes a thread page to break it, which is also the only place
   * either writer ever runs.
   */
  queryClient.setQueryData(queryKeys.conversations.list(), {
    pages: [
      {
        data: [
          makeConversation({ id: CONVERSATION_ID, unreadCount: 5 }),
          makeConversation({ id: 99, unreadCount: 2 }),
        ],
        nextCursor: null,
      },
    ],
    pageParams: [null],
  })

  queryClient.setQueryData(
    queryKeys.conversations.detail(CONVERSATION_ID),
    makeConversation({ id: CONVERSATION_ID, unreadCount: 5 })
  )

  return {
    queryClient,
    user: userEvent.setup(),
    row: (conversationId: number) =>
      queryClient
        .getQueryData<ListCache>(queryKeys.conversations.list())
        ?.pages[0]?.data.find((conversation) => conversation.id === conversationId),
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  }
}

describe('useMarkConversationRead', () => {
  function ReadProbe() {
    const markRead = useMarkConversationRead()
    return (
      <button type="button" onClick={() => markRead.mutate(CONVERSATION_ID)}>
        lire
      </button>
    )
  }

  it('sends the read receipt while a thread page has the conversation cached on its own', async () => {
    /*
     * The assertion is on the request reaching the server, not on the badge clearing.
     *
     * Clearing the badge is the optimistic half, and it kept working throughout the bug this
     * covers: `onMutate` cleared the count and then threw on the detail entry, which React Query
     * treats as the mutation failing before it started. Nothing was ever sent, so the count came
     * back on the next load — a test watching only the cache would have stayed green.
     */
    const receiptsFor: number[] = []
    server.use(
      http.post('/api/conversations/:conversationId/read', ({ params }) => {
        receiptsFor.push(Number(params.conversationId))
        return new HttpResponse(null, { status: 204 })
      })
    )

    const { user, row, getByRole } = renderProbe(<ReadProbe />)

    await user.click(getByRole('button', { name: 'lire' }))

    await waitFor(() => expect(receiptsFor).toEqual([CONVERSATION_ID]))
    expect(row(CONVERSATION_ID)?.unreadCount).toBe(0)
    // The rest of the list is left alone.
    expect(row(99)?.unreadCount).toBe(2)
  })

  it('leaves the detail entry to the refetch rather than writing a list shape over it', async () => {
    const { user, queryClient, getByRole } = renderProbe(<ReadProbe />)

    await user.click(getByRole('button', { name: 'lire' }))

    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(queryClient.getQueryData(queryKeys.conversations.detail(CONVERSATION_ID))).toMatchObject(
      {
        id: CONVERSATION_ID,
      }
    )
  })
})

describe('useBumpConversation', () => {
  it('rewrites the row it is given without throwing on the thread page cache', async () => {
    /*
     * The thrown error is asserted as well as the rewrite, because the rewrite alone does not
     * catch this. `setQueriesData` visits the list before the detail entry, so the row was
     * already patched by the time the bad shape threw — the write looked right, and what the
     * caller lost was everything it does after the bump.
     */
    let thrown: unknown
    function BumpProbe() {
      const bump = useBumpConversation()
      return (
        <button
          type="button"
          onClick={() => {
            try {
              bump(CONVERSATION_ID, 1_800_000_000, 'A demain')
            } catch (error) {
              thrown = error
            }
          }}
        >
          envoyer
        </button>
      )
    }

    const { user, row, getByRole } = renderProbe(<BumpProbe />)

    await user.click(getByRole('button', { name: 'envoyer' }))

    await waitFor(() => expect(row(CONVERSATION_ID)?.preview).toBe('A demain'))
    expect(thrown).toBeUndefined()
    expect(row(99)?.preview).toBeUndefined()
  })
})
