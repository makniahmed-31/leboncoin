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

export const MAX_MESSAGE_LENGTH = 2000

export const messageSchema = z.object({
  id: z.coerce.number().check(z.int(), z.positive()),
  conversationId: z.coerce.number().check(z.int(), z.positive()),
  authorId: z.coerce.number().check(z.int(), z.positive()),
  /** Unix seconds. The original contract types this as a string; the data has always been a number. */
  timestamp: z.coerce.number().check(z.int(), z.gte(0)),
  body: z.string(),
})

export const messageListSchema = z.array(messageSchema)
export const messagePageSchema = pageSchema(messageSchema)

/**
 * Control characters are stripped rather than rejected: they are invisible to whoever pasted
 * them, so failing the send would look like a bug to the person who sent it. Newlines and tabs
 * survive, since those are things people type on purpose.
 */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point here
const CONTROL_CHARACTERS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

const normalise = (value: string) => value.replaceAll(CONTROL_CHARACTERS, '').trim()

/**
 * The one schema both sides use. In the composer it drives the counter and the disabled state;
 * in the API it is the actual guard, because nothing stops a client from posting directly.
 *
 * Normalising before the length check matters in both directions: padding cannot push a valid
 * message over the limit, and padding cannot disguise an empty one as full.
 */
export const sendMessageInputSchema = z.object({
  // The `error` argument replaces Zod's default English wording, which would otherwise be the
  // one string in a French interface that came from a library.
  body: z.pipe(
    z.pipe(z.string({ error: 'Le message est obligatoire.' }), z.transform(normalise)),
    z
      .string()
      .check(
        z.minLength(1, 'Le message ne peut pas etre vide.'),
        z.maxLength(MAX_MESSAGE_LENGTH, `Le message est limite a ${MAX_MESSAGE_LENGTH} caracteres.`)
      )
  ),

  /*
   * Idempotency key, generated once per message by the client and reused across every retry of
   * that message. It is what makes "send" safe to repeat after a timeout, where the client
   * genuinely cannot know whether the write landed.
   */
  clientId: z
    .string({ error: 'Identifiant de message invalide.' })
    .check(z.regex(/^[0-9a-f-]{16,64}$/i, 'Identifiant de message invalide.')),
})

export type Message = z.infer<typeof messageSchema>
export type MessagePage = z.infer<typeof messagePageSchema>
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>

/** What the thread shows next to a message the server has not acknowledged yet. */
export type MessageStatus = 'sent' | 'sending' | 'failed'
