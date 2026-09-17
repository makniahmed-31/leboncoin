import 'server-only'

import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import { toApiError } from './api-error'

/**
 * Wraps a route handler so every failure leaves through the same door, in the same shape, with a
 * status the client's retry policy can reason about. Without it each handler grows its own
 * try/catch and the error contract drifts one endpoint at a time.
 *
 * The request id is minted here when the caller did not supply one, and it is the same value
 * forwarded to the API — so one identifier covers the browser's request, this tier and the API
 * tier, and a report from a user resolves to one trace rather than three.
 */
export function route<Context>(
  handler: (request: Request, context: Context, requestId: string) => Promise<Response>
) {
  return async (request: Request, context: Context) => {
    const requestId = request.headers.get('x-request-id') ?? randomUUID()

    try {
      const response = await handler(request, context, requestId)
      response.headers.set('x-request-id', requestId)
      return response
    } catch (cause) {
      const error = toApiError(cause)

      // 5xx is our problem and belongs in the logs; 4xx is the caller's and does not.
      if (error.status >= 500) {
        console.error(`${request.method} ${new URL(request.url).pathname} [${requestId}]`, error)
      }

      return NextResponse.json(
        { ...error.toJSON(), requestId: error.requestId ?? requestId },
        { status: error.status, headers: { 'x-request-id': requestId } }
      )
    }
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
