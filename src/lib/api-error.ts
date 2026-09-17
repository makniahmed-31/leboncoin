import { type ApiErrorCode, isRetryableStatus } from '@/lib/contracts'

export type { ApiErrorCode }

/**
 * Every failure the application can show a user is funnelled into this shape, so retry policy and
 * error rendering branch on a code rather than sniffing strings or status numbers at call sites.
 *
 * The codes are the API's own, imported rather than restated. A second list of error codes on the
 * client is a list that drifts, and the drift shows up as an error screen that renders the
 * fallback text for a case somebody thought they had handled.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  /** Echoed by the API on every failure. Shown on the 500 screen so a report can be traced. */
  readonly requestId?: string
  readonly details?: unknown

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    options: { requestId?: string; details?: unknown } = {}
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = options.requestId
    this.details = options.details
  }

  get isRetryable() {
    return isRetryableStatus(this.status, this.code)
  }

  /** The wire shape, identical to the API's, so a client cannot tell which layer refused it. */
  toJSON() {
    return {
      statusCode: this.status,
      code: this.code,
      message: this.message,
      requestId: this.requestId,
    }
  }

  static unavailable(cause?: unknown) {
    return new ApiError('SERVICE_UNAVAILABLE', 503, 'Le service de messagerie est injoignable.', {
      details: cause,
    })
  }

  static timeout() {
    return new ApiError('TIMEOUT', 504, "Le service de messagerie n'a pas repondu a temps.")
  }
}

export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause
  if (cause instanceof DOMException && cause.name === 'AbortError') return ApiError.timeout()
  return new ApiError('INTERNAL_ERROR', 500, 'Une erreur inattendue est survenue.', {
    details: cause,
  })
}
