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
 * Coercion on the numeric ids is deliberate. The seed corpus this project inherits stores ids as
 * integers, the original specification types some of them as strings, and a single disagreement
 * between the two should land a user on a conversation rather than on an error screen.
 */
export const userSchema = z.object({
  id: z.coerce.number().check(z.int(), z.positive()),
  nickname: z.string().check(z.minLength(1)),
  avatarUrl: z.optional(z.string()),
})

export const userListSchema = z.array(userSchema)

export type User = z.infer<typeof userSchema>
