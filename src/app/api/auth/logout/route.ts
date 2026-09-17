import { NextResponse } from 'next/server'

import { route } from '@/lib/route-handler'
import { SESSION_COOKIE } from '@/lib/session'

/**
 * Clearing the cookie is the whole of it, because the session is the cookie.
 *
 * There is no server-side revocation, and that is a real limitation worth naming rather than
 * hiding: a token already copied off the machine stays valid until it expires. Fixing it needs a
 * denylist in Redis keyed by token id, checked by the API guard — which is a sensible next step
 * and deliberately not built for a short-lived token in a system with no refresh flow.
 */
export const POST = route(async () => {
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
})
