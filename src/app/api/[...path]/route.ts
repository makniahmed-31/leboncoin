import { NextResponse } from 'next/server'

import { API_URL } from '@/lib/env'
import { ApiError } from '@/lib/api-error'
import { route } from '@/lib/route-handler'
import { getSession } from '@/lib/session'

/**
 * One proxy for every read and write the browser makes.
 *
 * Writing a handler per endpoint would mean restating the API's routes in a second place and
 * keeping them in step by hand. This tier adds no business logic — it exists to attach the
 * access token from the httpOnly cookie and to carry the request id across — so expressing it
 * once as a pass-through is both less code and a more honest description of what it does.
 *
 * Next matches static segments before dynamic ones, so `/api/auth/login`, `/api/events` and
 * `/api/health` still reach their own handlers; everything else lands here.
 *
 * The API is not weakened by this being generic. It authenticates and authorises every request
 * on its own, identically whether the caller is this proxy or curl. What the proxy adds is that
 * the browser never holds a credential and never makes a cross-origin request.
 */
async function forward(request: Request, params: Promise<{ path: string[] }>, requestId: string) {
  const session = await getSession()
  if (!session) throw new ApiError('UNAUTHENTICATED', 401, 'Authentification requise.')

  const { path } = await params
  const url = new URL(request.url)

  /*
   * Only the query string is carried over, never the incoming headers.
   *
   * Forwarding headers wholesale is how a proxy leaks: an `authorization` header from the client
   * would override the one derived from the verified session, and a client-supplied
   * `x-forwarded-for` would poison the API's logs. The request id is the one thing worth
   * carrying, and it is validated by the route wrapper before it gets here.
   */
  const target = `${API_URL}/${path.join('/')}${url.search}`

  const response = await fetch(target, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.token}`,
      'x-request-id': requestId,
    },
    body: request.method === 'GET' ? undefined : await request.text(),
    cache: 'no-store',
  }).catch((cause: unknown) => {
    throw ApiError.unavailable(cause)
  })

  // 204 carries no body, and constructing a JSON response for one produces a malformed reply.
  if (response.status === 204) return new NextResponse(null, { status: 204 })

  // The API's body is passed through verbatim, including its error shape, so a client cannot
  // tell which tier refused it and there is no second error format to keep in step.
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
      ...(response.headers.get('retry-after')
        ? { 'retry-after': response.headers.get('retry-after') as string }
        : {}),
    },
  })
}

type Context = { params: Promise<{ path: string[] }> }

export const GET = route<Context>((request, { params }, requestId) =>
  forward(request, params, requestId)
)

export const POST = route<Context>((request, { params }, requestId) =>
  forward(request, params, requestId)
)
