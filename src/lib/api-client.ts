import { apiErrorSchema } from '@/lib/contracts'

import { ApiError, type ApiErrorCode } from './api-error'

const REQUEST_TIMEOUT_MS = 10_000

type Validatable<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } }

/**
 * Talks to this application's own route handlers, never to the API directly.
 *
 * Two consequences worth stating. The browser makes same-origin requests, so there is no CORS
 * configuration and no cross-site cookie to get wrong. And the access token is attached
 * server-side, so it never exists anywhere page JavaScript can reach.
 *
 * Server Components skip this module entirely and call the server data modules directly, so a
 * server render does not make an HTTP request to itself.
 */
async function apiFetch<T>(path: string, schema: Validatable<T>, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
      // The caller's signal comes from React Query, which aborts on unmount. Merging it with a
      // timeout means a hung request cannot pin a spinner open indefinitely.
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
        : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new ApiError('TIMEOUT', 504, 'La requete a mis trop de temps.')
    }
    // An abort is the caller's own doing — React Query unmounting the query — and must not be
    // reported to the user as a failure.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('NETWORK_ERROR', 0, 'Connexion impossible.', { details: cause })
  }

  if (!response.ok) throw await toApiError(response)

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    throw new ApiError('MALFORMED_RESPONSE', 502, 'Reponse inattendue du serveur.')
  }

  return parsed.data
}

async function toApiError(response: Response) {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json())
    if (parsed.success) {
      return new ApiError(parsed.data.code, parsed.data.statusCode, parsed.data.message, {
        requestId: parsed.data.requestId,
      })
    }
  } catch {
    // Not JSON: a proxy error page, or a connection cut mid-response.
  }

  const code: ApiErrorCode = response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR'
  return new ApiError(code, response.status, 'Une erreur est survenue.')
}

export function apiGet<T>(path: string, schema: Validatable<T>, signal?: AbortSignal) {
  return apiFetch(path, schema, { signal })
}

export function apiPost<T>(
  path: string,
  body: unknown,
  schema: Validatable<T>,
  signal?: AbortSignal
) {
  return apiFetch(path, schema, { method: 'POST', body: JSON.stringify(body), signal })
}

/** Fire-and-observe for endpoints with no response body, such as marking a thread read. */
export async function apiPostVoid(path: string, body?: unknown) {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) throw await toApiError(response)
}
