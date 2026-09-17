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

/**
 * What the server pushes, in the one shape both the SSE stream and the polling fallback produce.
 *
 * These are notifications, not payloads: an event says a thread changed, and the client refetches
 * through the same cache it already uses. Shipping message bodies down the stream would mean two
 * code paths writing into the query cache and two chances for them to disagree — and an
 * authorisation decision on the fan-out side as well as on the read side.
 */
export const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message.created'),
    conversationId: z.coerce.number().check(z.int(), z.positive()),
    messageId: z.coerce.number().check(z.int(), z.positive()),
    authorId: z.coerce.number().check(z.int(), z.positive()),
    timestamp: z.coerce.number().check(z.int(), z.gte(0)),
  }),
  z.object({
    type: z.literal('conversation.created'),
    conversationId: z.coerce.number().check(z.int(), z.positive()),
  }),
  z.object({
    type: z.literal('conversation.read'),
    conversationId: z.coerce.number().check(z.int(), z.positive()),
  }),

  /*
   * Typing and presence are the two events that carry their whole meaning in the frame, and they
   * are the exception to the rule stated above rather than a departure from it. "Someone is
   * typing" has nothing behind it to refetch — there is no resource, no row, and nothing that
   * outlives the next few seconds — so a notification telling the client to go and look would be
   * asking it to fetch a fact that only exists here.
   *
   * Both are also deliberately allowed to be lost. A dropped `message.created` costs a stale
   * thread until the next refetch, which is why it is a notification; a dropped `typing.changed`
   * costs three dots that fade on their own a moment later. That difference is what lets these
   * skip the delivery guarantees the rest of the stream leans on.
   */
  z.object({
    type: z.literal('typing.changed'),
    conversationId: z.coerce.number().check(z.int(), z.positive()),
    userId: z.coerce.number().check(z.int(), z.positive()),
    typing: z.boolean(),
  }),

  z.object({
    type: z.literal('presence.changed'),
    userId: z.coerce.number().check(z.int(), z.positive()),
    online: z.boolean(),
    /** Unix seconds. Present when the member just went offline, absent while they are online. */
    lastSeenAt: z.optional(z.coerce.number().check(z.int(), z.gte(0))),
  }),
])

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>

/**
 * Redis channel an event is published on: one per user, not one per conversation.
 *
 * A subscriber count that follows connected users rather than open threads is the difference
 * between a bounded number of subscriptions per API replica and one that grows with the corpus.
 * The publisher already knows the participants of the thread it just wrote to, so the fan-out
 * costs one PUBLISH per participant and needs no membership lookup on the delivery side.
 */
export const userChannel = (userId: number) => `events:user:${userId}`
