import 'server-only'

import { apiErrorSchema } from '@/lib/contracts'

import { ApiError, type ApiErrorCode } from './api-error'
import { maybeFail } from './chaos'
import { API_TIMEOUT_MS, API_URL } from './env'

type Validatable<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } }

/**
 * The single door to the API. Nothing outside the server modules reaches it.
 *
 * This layer is thin on purpose, and it is worth being explicit about why it exists at all now
 * that the backend is not a fixture server. It does three things the browser cannot be trusted
 * to do: it attaches the bearer token read from the httpOnly cookie, it forwards the request id
 * so one identifier spans both services, and it turns every failure into the same `ApiError` the
 * rest of the application already knows how to render. It contains no business rules — those
 * belong to the API, which enforces them whether or not a request came through here.
 */
async function request(
  path: string,
  token: string,
  init: RequestInit & { requestId?: string } = {}
) {
  maybeFail()

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.requestId ? { 'x-request-id': init.requestId } : {}),
        ...init.headers,
      },
      // Messaging data is per-user and changes constantly; a cached response here would be one
      // user's inbox served to another.
      cache: 'no-store',
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'TimeoutError') throw ApiError.timeout()
    throw ApiError.unavailable(cause)
  }

  if (!response.ok) throw await toApiError(response)

  // 204 has no body to parse, and calling .json() on one throws.
  return response.status === 204 ? null : ((await response.json()) as unknown)
}

/**
 * The API's error shape is parsed rather than assumed.
 *
 * A 502 from a load balancer standing in front of a dead API returns HTML, not JSON, and a layer
 * that assumes otherwise turns an outage into an unhandled parse error somewhere far less
 * legible than here.
 */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json())

    if (parsed.success) {
      return new ApiError(parsed.data.code, parsed.data.statusCode, parsed.data.message, {
        requestId: parsed.data.requestId,
        details: parsed.data.details,
      })
    }
  } catch {
    // Fall through to the generic mapping below.
  }

  const code: ApiErrorCode = response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR'
  return new ApiError(code, response.status, 'Le service de messagerie est indisponible.')
}

function parse<T>(payload: unknown, schema: Validatable<T>): T {
  const result = schema.safeParse(payload)

  if (!result.success) {
    // A response that does not match the contract is a deployment problem — the two services are
    // on different versions — and it has to be loud rather than rendered as empty state.
    throw new ApiError('MALFORMED_RESPONSE', 502, 'Reponse inattendue du service de messagerie.')
  }

  return result.data
}

export async function apiGetServer<T>(
  path: string,
  token: string,
  schema: Validatable<T>,
  requestId?: string
): Promise<T> {
  return parse(await request(path, token, { requestId }), schema)
}

export async function apiPostServer<T>(
  path: string,
  token: string,
  body: unknown,
  schema: Validatable<T>,
  requestId?: string
): Promise<T> {
  const payload = await request(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
    requestId,
  })
  return parse(payload, schema)
}

/** For endpoints that answer 204, where there is nothing to validate. */
export async function apiPostServerVoid(path: string, token: string, body?: unknown) {
  await request(path, token, {
    method: 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
