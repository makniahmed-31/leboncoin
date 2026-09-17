/*
 * The API contract, mirrored from the backend repository (`leboncoin-api/src/contracts`).
 *
 * Two repositories cannot share a workspace package, and the honest options were: vendor a copy,
 * publish the contract to a registry, or generate types from the API's OpenAPI document. This is
 * the first, and the trade is stated rather than hidden — a copy can drift, and nothing here
 * detects that automatically.
 *
 * What makes the drift survivable is that these schemas are *parsed* against every response, not
 * merely used as types. A backend that changes shape produces a MALFORMED_RESPONSE error with a
 * request id rather than an undefined rendering three components deep. The production answer is a
 * published package consumed by both sides, which is a registry away rather than a redesign.
 */

import * as z from 'zod/mini'

import { pageSchema } from './pagination'
import { productSchema } from './product'

/**
 * A conversation as the API exposes it.
 *
 * The database models participation as its own table, so a thread is not structurally limited to
 * two people. This projection is: `senderId`/`recipientId` are the shape the original contract
 * defines and the shape the UI was built against, and the server derives them from the two
 * participant rows. Keeping the projection at the edge means group threads become a second
 * response shape rather than a migration of everything that already works.
 */
export const conversationSchema = z.object({
  id: z.coerce.number().check(z.int(), z.positive()),
  senderId: z.coerce.number().check(z.int(), z.positive()),
  senderNickname: z.string().check(z.minLength(1)),
  recipientId: z.coerce.number().check(z.int(), z.positive()),
  recipientNickname: z.string().check(z.minLength(1)),
  lastMessageTimestamp: z.coerce.number().check(z.int(), z.gte(0)),

  /*
   * The last message, flattened onto the row the list renders.
   *
   * This is denormalised into the conversation table rather than joined per row. The join is the
   * classic N+1 on a messaging list — thirty conversations, thirty "newest message in this
   * thread" lookups — and it is the one query that runs on every single page view. Writing the
   * preview inside the same transaction as the message costs one extra UPDATE per send and
   * removes a fan-out per read.
   */
  preview: z.optional(z.string()),
  lastMessageAuthorId: z.optional(z.coerce.number().check(z.int(), z.positive())),

  /** Messages after this participant's `lastReadAt`. Capped server-side; see the README. */
  unreadCount: z.coerce.number().check(z.int(), z.gte(0)),

  product: z.optional(productSchema),
})

/**
 * How much of the last message the list needs.
 *
 * The line is one row of truncated text, so the remaining 1,900-odd characters a message may
 * hold would be downloaded for every conversation on the page and then clipped by CSS. Cutting
 * at write time keeps the list response proportional to what it displays.
 */
export const PREVIEW_LENGTH = 120

export const conversationListSchema = z.array(conversationSchema)
export const conversationPageSchema = pageSchema(conversationSchema)

export const createConversationInputSchema = z.object({
  recipientId: z.coerce
    .number({ error: 'Destinataire invalide.' })
    .check(z.int('Destinataire invalide.'), z.positive('Destinataire invalide.')),
  productId: z.optional(z.coerce.number().check(z.int(), z.positive())),
})

export type Conversation = z.infer<typeof conversationSchema>
export type ConversationPage = z.infer<typeof conversationPageSchema>
export type CreateConversationInput = z.infer<typeof createConversationInputSchema>

/**
 * A conversation carries both sides and the logged user may be either one, because a thread is
 * returned whether they started it or received it. Everything the UI shows about "the other
 * person" goes through here rather than assuming the logged user is the sender.
 */
export function counterpartOf(conversation: Conversation, currentUserId: number) {
  const isSender = conversation.senderId === currentUserId
  return {
    id: isSender ? conversation.recipientId : conversation.senderId,
    nickname: isSender ? conversation.recipientNickname : conversation.senderNickname,
  }
}
