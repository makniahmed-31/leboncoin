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

export * from './conversation'
export * from './errors'
export * from './message'
export * from './pagination'
export * from './presence'
export * from './product'
export * from './realtime'
export * from './user'
