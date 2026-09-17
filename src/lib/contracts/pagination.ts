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
 * The page envelope every list endpoint returns.
 *
 * `nextCursor` is opaque on purpose. The server currently encodes a keyset position — the
 * `(timestamp, id)` pair of the last row on the page — but nothing downstream is allowed to
 * decode it or do arithmetic on it, so the pagination strategy can change without a client
 * release. `hasMore` is carried explicitly rather than inferred from a short page: a page can be
 * exactly `limit` long and still be the last one, and a client that guesses renders one dead
 * "load more" press per list.
 */
export function pageSchema<T extends z.ZodMiniType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.nullable(z.string()),
    hasMore: z.boolean(),
  })
}

export type Page<T> = { data: T[]; nextCursor: string | null; hasMore: boolean }

export const DEFAULT_PAGE_SIZE = 30
export const MAX_PAGE_SIZE = 100

/** Messages arrive in larger pages than conversations: a screenful of chat is more rows. */
export const DEFAULT_MESSAGE_PAGE_SIZE = 50

export const emptyPage = <T>(): Page<T> => ({ data: [], nextCursor: null, hasMore: false })
