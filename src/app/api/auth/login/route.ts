import { NextResponse } from 'next/server'
import * as z from 'zod/mini'
import { userSchema } from '@/lib/contracts'

import { ApiError } from '@/lib/api-error'
import { API_URL, COOKIE_SECURE } from '@/lib/env'
import { readJson, route } from '@/lib/route-handler'
import { SESSION_COOKIE } from '@/lib/session'

const inputSchema = z.object({ nickname: z.string().check(z.minLength(1), z.maxLength(64)) })

const sessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  expiresInSeconds: z.number(),
})

/**
 * The one place the access token is allowed to exist outside the API.
 *
 * It is exchanged here, server-side, and written straight into an httpOnly cookie — so it is
 * never in a response body the browser can read, never in `localStorage`, and never reachable by
 * a script that gets injected into the page. The browser leaves this request holding a cookie it
 * cannot inspect, which is the entire security argument for putting a BFF in front of the API.
 */
export const POST = route(async (request) => {
  const input = inputSchema.safeParse(await readJson(request))
  if (!input.success) {
    throw new ApiError('VALIDATION_FAILED', 400, 'Identifiant invalide.')
  }

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.data),
    cache: 'no-store',
  }).catch((cause: unknown) => {
    throw ApiError.unavailable(cause)
  })

  if (!response.ok) {
    throw new ApiError('UNAUTHENTICATED', 401, 'Identifiants invalides.')
  }

  const session = sessionSchema.safeParse(await response.json())
  if (!session.success) {
    throw new ApiError('MALFORMED_RESPONSE', 502, 'Reponse inattendue du service.')
  }

  // Only the member is returned. The token stays in the cookie.
  const body = NextResponse.json(session.data.user)

  body.cookies.set(SESSION_COOKIE, session.data.accessToken, {
    httpOnly: true,
    // `lax` rather than `strict`: `strict` would drop the cookie on any navigation arriving from
    // another site, so a shared link to a conversation would land on the login screen even
    // though the member is signed in. It still blocks the cross-site POST that matters.
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: session.data.expiresInSeconds,
    path: '/',
  })

  return body
})
