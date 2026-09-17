import { ApiError } from '@/lib/api-error'
import { API_URL } from '@/lib/env'
import { getSession } from '@/lib/session'

/**
 * Streams the API's server-sent events through to the browser.
 *
 * It cannot go through the generic proxy, which buffers a whole response before answering — that
 * is exactly wrong for a connection whose entire purpose is to stay open and deliver bytes as
 * they arrive. Here the upstream body is handed back as the response body, so the stream is
 * relayed rather than collected.
 *
 * `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` are both load-bearing: without them Next
 * is entitled to treat this route as static and cache it, which turns a live stream into a
 * single response that never updates and is very hard to diagnose from the client side.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getSession()

  if (!session) {
    return Response.json(new ApiError('UNAUTHENTICATED', 401, 'Session requise.').toJSON(), {
      status: 401,
    })
  }

  let upstream: Response

  try {
    upstream = await fetch(`${API_URL}/events`, {
      headers: { authorization: `Bearer ${session.token}`, accept: 'text/event-stream' },
      // The browser aborts this fetch when the tab closes or EventSource is torn down. Passing
      // the signal through is what closes the upstream connection too — without it every
      // reconnect leaks a stream on the API and a Redis subscription behind it.
      signal: request.signal,
      cache: 'no-store',
    })
  } catch {
    // The client's EventSource reconnects on its own, and the polling transport is the floor
    // beneath this, so a failure here degrades the refresh rate rather than breaking the page.
    return new Response(null, { status: 503 })
  }

  if (!upstream.ok || !upstream.body) return new Response(null, { status: 503 })

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Nginx buffers proxied responses by default, which holds events back until the buffer
      // fills — for an event stream that means delivery in bursts, or not at all.
      'x-accel-buffering': 'no',
    },
  })
}
