import { NextResponse } from 'next/server'
import * as z from 'zod/mini'
import { userSchema } from '@/lib/contracts'

import { ApiError } from '@/lib/api-error'
import { API_URL, COOKIE_SECURE } from '@/lib/env'
import { readJson, route } from '@/lib/route-handler'
import { SESSION_COOKIE } from '@/lib/session'

// Mirrors the API's registration rule so the obvious mistakes are caught without a round trip.
// The API re-validates regardless; this is a courtesy, never the guard.
const inputSchema = z.object({ nickname: z.string().check(z.minLength(2), z.maxLength(32)) })

const sessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  expiresInSeconds: z.number(),
})

/**
 * Creating a member, and the same token handling as signing in.
 *
 * It is a near-twin of the login handler and deliberately a separate file rather than a flag on
 * that one: the two differ in the status they answer, the failure they can produce and the
 * validation the API applies, and a shared handler branching on `mode` would hide all three
 * behind a boolean. The part that genuinely must not diverge — writing the token into an
 * httpOnly cookie and returning only the member — is the part this duplicates verbatim.
 *
 * As with login, the access token never reaches the browser: it is exchanged here, server-side,
 * and written straight into a cookie page JavaScript cannot read.
 */
export const POST = route(async (request) => {
  const input = inputSchema.safeParse(await readJson(request))
  if (!input.success) {
    throw new ApiError('VALIDATION_FAILED', 400, 'Pseudo invalide.')
  }

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.data),
    cache: 'no-store',
  }).catch((cause: unknown) => {
    throw ApiError.unavailable(cause)
  })

  /*
   * The API's refusal is relayed rather than flattened into one message. A taken pseudonym and a
   * malformed one are different things for the person at the keyboard — one needs a different
   * name, the other needs a correction — and collapsing both into "invalid" would make the form
   * unable to say which.
   */
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
    } | null

    if (body?.code === 'NICKNAME_TAKEN') {
      throw new ApiError('NICKNAME_TAKEN', 409, body.message ?? 'Ce pseudo est deja pris.')
    }
    if (body?.code === 'RATE_LIMITED') {
      throw new ApiError('RATE_LIMITED', 429, body.message ?? 'Trop de tentatives. Reessayez.')
    }

    throw new ApiError('VALIDATION_FAILED', 400, body?.message ?? 'Pseudo invalide.')
  }

  const session = sessionSchema.safeParse(await response.json())
  if (!session.success) {
    throw new ApiError('MALFORMED_RESPONSE', 502, 'Reponse inattendue du service.')
  }

  // Only the member is returned. The token stays in the cookie. 201, because this call created
  // something — the client does not branch on it, but a proxy that logs status codes should see
  // the difference between a sign-in and a sign-up.
  const body = NextResponse.json(session.data.user, { status: 201 })

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
