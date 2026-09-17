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
 * The closed set of failures the API is allowed to describe.
 *
 * Codes exist so that clients branch on an identifier rather than on a status number or, worse,
 * on message text: several distinct conditions share a 404, and the messages are translated.
 * Nothing here names a table, a driver or an internal exception — that mapping happens once, in
 * the exception filter, and the internal detail goes to the log rather than to the response.
 */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'USER_NOT_FOUND',
  'CONVERSATION_NOT_FOUND',
  'MESSAGE_NOT_FOUND',
  'PRODUCT_NOT_FOUND',
  'SELF_CONVERSATION',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'SERVICE_UNAVAILABLE',
  'TIMEOUT',
  'NETWORK_ERROR',
  'MALFORMED_RESPONSE',
  'INTERNAL_ERROR',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/**
 * `requestId` is the one field that ties a screen a user is looking at to a line in the logs.
 * It is echoed on every error, including 500s, which is what makes "it broke at 14:32" a
 * searchable question instead of a conversation.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
  requestId: z.optional(z.string()),
  /** Field-level detail, present only for VALIDATION_FAILED. Never carries internal state. */
  details: z.optional(z.array(z.object({ path: z.string(), message: z.string() }))),
})

export type ApiErrorBody = z.infer<typeof apiErrorSchema>

/** 4xx means the request itself is wrong; repeating it unchanged cannot turn it into a 200. */
export function isRetryableStatus(status: number, code?: ApiErrorCode) {
  if (code === 'TIMEOUT' || code === 'NETWORK_ERROR') return true
  return status >= 500
}
