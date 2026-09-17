import 'server-only'

import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { cache } from 'react'

import { ApiError } from './api-error'
import { AUTH_SECRET } from './env'

export const SESSION_COOKIE = 'lbc_session'

export type Session = {
  userId: number
  nickname: string
  /** The bearer token forwarded to the API. Never leaves the server. */
  token: string
}

/**
 * The session token lives in an httpOnly cookie, so page JavaScript cannot read it.
 *
 * That is the whole reason this application keeps a server-side seam in front of the API instead
 * of letting the browser call it directly. A token in localStorage is a token any injected script
 * can exfiltrate, and "we have no XSS" is a claim about every dependency in the bundle rather
 * than about code anyone has read. Here the credential is only ever attached by the server, on
 * its way out.
 */
const secret = () => new TextEncoder().encode(AUTH_SECRET)

/**
 * Verified, not merely decoded.
 *
 * Reading the payload without checking the signature would be cheaper, and the cookie is
 * httpOnly, so where would a forged one come from? But "this cookie can only have come from us"
 * is exactly the assumption that quietly stops holding when a proxy changes or a subdomain is
 * handed to another team, and the check costs microseconds. The API verifies it again regardless;
 * this second check is what stops the web tier rendering a page as the wrong person before the
 * API ever gets the chance to refuse.
 *
 * `cache` scopes the result to one render, so a layout and the components inside it share a
 * single verification rather than repeating it.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !AUTH_SECRET) return null

  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'lbc-messaging' })
    const userId = Number(payload.sub)
    const nickname = typeof payload.nickname === 'string' ? payload.nickname : ''

    if (!Number.isInteger(userId) || userId <= 0 || !nickname) return null

    return { userId, nickname, token }
  } catch {
    // Expired, tampered with, or signed with a rotated secret. All three mean "log in again",
    // and telling them apart would only help somebody probing.
    return null
  }
})

/**
 * For code paths that cannot render anything meaningful without an identity.
 *
 * Throwing rather than returning null is deliberate: a `Session | null` that every call site has
 * to narrow is a call site that eventually forgets, and the cost of forgetting is a query that
 * runs unscoped. This one cannot be ignored by accident.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new ApiError('UNAUTHENTICATED', 401, 'Authentification requise.')
  return session
}
