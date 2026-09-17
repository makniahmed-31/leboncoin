import * as z from 'zod/mini'
import { DEFAULT_PAGE_SIZE, productSchema } from '@/lib/contracts'

import { apiGet, apiPost, apiPostVoid } from '@/lib/api-client'

import { conversationPageSchema, conversationSchema, userListSchema } from '../schemas'

export function fetchConversationPage(
  cursor: string | null,
  search: string | undefined,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ limit: String(DEFAULT_PAGE_SIZE) })
  if (cursor) params.set('cursor', cursor)
  if (search) params.set('q', search)
  return apiGet(`/conversations?${params}`, conversationPageSchema, signal)
}

export function fetchConversation(conversationId: number, signal?: AbortSignal) {
  return apiGet(`/conversations/${conversationId}`, conversationSchema, signal)
}

export function fetchContacts(signal?: AbortSignal) {
  return apiGet('/users', userListSchema, signal)
}

export function fetchProducts(signal?: AbortSignal) {
  return apiGet('/products', z.array(productSchema), signal)
}

export function createConversationRequest(input: { recipientId: number; productId?: number }) {
  return apiPost('/conversations', input, conversationSchema)
}

/** Fire-and-forget by design: a failed read receipt is not worth interrupting the user for. */
export function markConversationReadRequest(conversationId: number) {
  return apiPostVoid(`/conversations/${conversationId}/read`)
}
