import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { notFound, redirect } from 'next/navigation'
import { DEFAULT_MESSAGE_PAGE_SIZE } from '@/lib/contracts'

import { getConversation } from '@/features/conversations/api/server'
import { ConversationHeader } from '@/features/conversations/components/conversation-header'
import { counterpartOf } from '@/features/conversations/schemas'
import { listMessages } from '@/features/messages/api/server'
import { MessageThread } from '@/features/messages/components/message-thread'
import { ApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { getServerQueryClient } from '@/lib/server-query'
import { getSession } from '@/lib/session'

type Props = { params: Promise<{ conversationId: string }> }

export default async function ConversationPage({ params }: Props) {
  const conversationId = Number((await params).conversationId)
  if (!Number.isInteger(conversationId) || conversationId <= 0) notFound()

  const session = await getSession()
  if (!session) redirect('/login')

  const queryClient = getServerQueryClient()

  let conversation
  try {
    conversation = await getConversation(session, conversationId)
  } catch (cause) {
    // A conversation that does not exist and one that belongs to somebody else are the same 404
    // here, because the API answers both the same way — deliberately, so that a guessed id
    // cannot be used to find out which ids are real.
    if (cause instanceof ApiError && cause.status === 404) notFound()
    throw cause
  }

  queryClient.setQueryData(queryKeys.conversations.detail(conversationId), conversation)

  await queryClient
    .prefetchInfiniteQuery({
      queryKey: queryKeys.messages.list(conversationId),
      queryFn: () => listMessages(session, conversationId, { limit: DEFAULT_MESSAGE_PAGE_SIZE }),
      initialPageParam: null as string | null,
    })
    .catch(() => undefined)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ConversationHeader conversation={conversation} currentUserId={session.userId} />
      <MessageThread
        conversationId={conversationId}
        currentUserId={session.userId}
        counterpart={counterpartOf(conversation, session.userId)}
      />
    </HydrationBoundary>
  )
}
