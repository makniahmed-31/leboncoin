import { DEFAULT_MESSAGE_PAGE_SIZE } from '@/lib/contracts'

import { apiGet, apiPost } from '@/lib/api-client'

import type { SendMessageInput } from '../schemas'
import { messagePageSchema, messageSchema } from '../schemas'

export function fetchMessagePage(
  conversationId: number,
  cursor: string | null,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(DEFAULT_MESSAGE_PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  return apiGet(`/conversations/${conversationId}/messages?${params}`, messagePageSchema, signal)
}

export function sendMessageRequest(conversationId: number, input: SendMessageInput) {
  return apiPost(`/conversations/${conversationId}/messages`, input, messageSchema)
}
