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
 * The listing a conversation is about.
 *
 * Prices are integer cents, never floats: 19.99 has no exact binary representation, and a
 * marketplace that rounds a price differently on two screens has a support ticket rather than a
 * bug. Formatting to a currency string is the client's job, because it depends on the locale.
 */
export const productSchema = z.object({
  id: z.coerce.number().check(z.int(), z.positive()),
  title: z.string().check(z.minLength(1)),
  priceCents: z.coerce.number().check(z.int(), z.gte(0)),
  currency: z.string(),
  imageUrl: z.optional(z.string()),
  sellerId: z.coerce.number().check(z.int(), z.positive()),
})

export type Product = z.infer<typeof productSchema>

export function formatPrice(product: Pick<Product, 'priceCents' | 'currency'>, locale = 'fr-FR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: product.currency,
    maximumFractionDigits: product.priceCents % 100 === 0 ? 0 : 2,
  }).format(product.priceCents / 100)
}
