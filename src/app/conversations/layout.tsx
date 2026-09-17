import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { DEFAULT_PAGE_SIZE } from '@/lib/contracts'

import { listConversations } from '@/features/conversations/api/server'
import { ConversationList } from '@/features/conversations/components/conversation-list'
import { queryKeys } from '@/lib/query-keys'
import { getServerQueryClient } from '@/lib/server-query'
import { getSession } from '@/lib/session'
import { LiveGate } from '@/shared/live/live-gate'

import { ConversationsShell } from './shell'

/**
 * The list is fetched on the server and handed over through the query cache rather than as props.
 *
 * Passing it as `initialData` would put the same data in two places, and the first client
 * refetch would throw the server copy away. Dehydrating it means the client's `useInfiniteQuery`
 * finds a warm cache under the key it was going to use anyway, so the first paint already has
 * content and no request goes out.
 */
export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  /*
   * The gate is here rather than in middleware.
   *
   * Middleware runs before every request including static assets, and verifying a signature there
   * puts crypto on a path that mostly serves images. This layout wraps every authenticated route
   * in the application, runs once per navigation, and shares its verification with the page
   * inside it through React's request cache — so the check happens where the data is, exactly
   * once.
   */
  if (!session) redirect('/login')

  const queryClient = getServerQueryClient()

  // Not awaited with a throw: a dead API must still render the shell, the list's own error state
  // and the composer. The client query picks the failure up and offers a retry.
  await queryClient
    .prefetchInfiniteQuery({
      queryKey: queryKeys.conversations.list(),
      queryFn: () => listConversations(session, { limit: DEFAULT_PAGE_SIZE }),
      initialPageParam: null as string | null,
    })
    .catch(() => undefined)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Everything below this point is behind the redirect above, so the stream belongs open.
          The root layout's own flag cannot be relied on: it is captured when that layout renders,
          which for a member who just signed in was the login screen with no session. */}
      <LiveGate />
      <ConversationsShell
        list={<ConversationList currentUserId={session.userId} nickname={session.nickname} />}
      >
        {children}
      </ConversationsShell>
    </HydrationBoundary>
  )
}
