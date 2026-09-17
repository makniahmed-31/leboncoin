import 'server-only'

import * as z from 'zod/mini'
import {
  DEFAULT_PAGE_SIZE,
  conversationPageSchema,
  conversationSchema,
  productSchema,
  userListSchema,
  type Page,
} from '@/lib/contracts'

import type { Session } from '@/lib/session'
import { apiGetServer, apiPostServer, apiPostServerVoid } from '@/lib/upstream'

import type { Conversation, Product, User } from '../schemas'

/**
 * The server-side data layer for conversations.
 *
 * Every function takes the session rather than reading it, so a Server Component and a route
 * handler share one code path and neither can address a different user's data by omission. The
 * token travels with the call; the API is what actually enforces the scoping, and this layer
 * cannot weaken it.
 *
 * What used to live here — repairing broken endpoints, sorting client-side, fanning out one
 * request per row to build preview lines — is gone. The API returns conversations already
 * ordered, already previewed and already counted, which is a page that costs one query instead
 * of thirty-one.
 */
function pageQuery(cursor: string | null, limit: number, search?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  if (search) params.set('q', search)
  return params
}

export function listConversations(
  session: Session,
  options: { cursor?: string | null; limit?: number; search?: string } = {}
): Promise<Page<Conversation>> {
  const query = pageQuery(
    options.cursor ?? null,
    options.limit ?? DEFAULT_PAGE_SIZE,
    options.search
  )
  return apiGetServer(`/conversations?${query}`, session.token, conversationPageSchema)
}

export function getConversation(session: Session, conversationId: number): Promise<Conversation> {
  return apiGetServer(`/conversations/${conversationId}`, session.token, conversationSchema)
}

/** Everyone except the logged member. The API decides who that is; this cannot widen it. */
export function listContacts(session: Session): Promise<User[]> {
  return apiGetServer('/users', session.token, userListSchema)
}

export function listProducts(session: Session): Promise<Product[]> {
  return apiGetServer('/products', session.token, z.array(productSchema))
}

/**
 * Creating is idempotent on the API side: an existing thread for the same pair and listing is
 * returned rather than duplicated, so a double submit or a retry after a timeout lands the user
 * in the same conversation. Nothing here needs to guard against that, which is the point of
 * putting the constraint in the database.
 */
export function createConversation(
  session: Session,
  input: { recipientId: number; productId?: number }
): Promise<Conversation> {
  return apiPostServer('/conversations', session.token, input, conversationSchema)
}

export function markConversationRead(session: Session, conversationId: number): Promise<void> {
  return apiPostServerVoid(`/conversations/${conversationId}/read`, session.token)
}
