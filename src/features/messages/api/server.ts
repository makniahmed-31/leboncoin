import 'server-only'

import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  messagePageSchema,
  messageSchema,
  type Page,
} from '@/lib/contracts'

import type { Session } from '@/lib/session'
import { apiGetServer, apiPostServer } from '@/lib/upstream'

import type { Message, SendMessageInput } from '../schemas'

/**
 * Messages arrive newest-first and cursor-paginated, because a thread is read from its end: the
 * user wants the last screenful, then older history as they scroll up. The cursor is opaque here
 * and stays opaque — nothing in this application decodes it or does arithmetic on it, so the
 * API's pagination strategy can change without a release on this side.
 */
export function listMessages(
  session: Session,
  conversationId: number,
  options: { cursor?: string | null; limit?: number } = {}
): Promise<Page<Message>> {
  const params = new URLSearchParams({ limit: String(options.limit ?? DEFAULT_MESSAGE_PAGE_SIZE) })
  if (options.cursor) params.set('cursor', options.cursor)

  return apiGetServer(
    `/conversations/${conversationId}/messages?${params}`,
    session.token,
    messagePageSchema
  )
}

/**
 * The author is never sent. It comes from the token the API verifies, so a client cannot post as
 * somebody else even by talking to the API directly — which is the only version of that
 * guarantee worth having, since a check that lives in this tier protects nothing.
 */
export function sendMessage(
  session: Session,
  conversationId: number,
  input: SendMessageInput
): Promise<Message> {
  return apiPostServer(
    `/conversations/${conversationId}/messages`,
    session.token,
    input,
    messageSchema
  )
}
