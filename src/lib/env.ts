import 'server-only'

/**
 * The API base URL, and deliberately not NEXT_PUBLIC_.
 *
 * Only the server reaches the API: Server Components call it directly, and the browser calls
 * this application's own route handlers, which forward. Keeping the value off the client is what
 * lets the API sit on a private network with no public ingress at all — and it is the reason
 * there is no CORS configuration to get wrong.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:3005/api'

/** Signs the session cookie's token. The same secret the API verifies with. */
export const AUTH_SECRET = process.env.AUTH_SECRET ?? ''

/**
 * Whether the session cookie carries the `Secure` attribute. On by default, and the default is
 * the one to keep: without it the cookie travels in cleartext on every request.
 *
 * It is a variable rather than a check on NODE_ENV because a production build and an HTTPS
 * origin are two different things. This deployment is reached over plain HTTP on an IP address,
 * and a browser silently discards a `Secure` cookie on such an origin — the sign-in succeeds,
 * the cookie is dropped, and the member lands back on the login screen with nothing to explain
 * why. Turning it off is only defensible while there is no TLS in front; putting a certificate
 * there is what makes this line go away.
 */
export const COOKIE_SECURE = process.env.COOKIE_SECURE !== 'false'

/** Timeout for a single call to the API, in milliseconds. */
export const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 5000)

/**
 * Probability, between 0 and 1, that a call to the API fails instead of being made.
 *
 * The degraded-backend behaviour has to be exercisable on demand, and it is injected here rather
 * than in the route handlers so that it hits server-rendered pages too — which is where a broken
 * backend actually shows up first. Off unless explicitly set.
 */
export const CHAOS_RATE = Math.min(Math.max(Number(process.env.CHAOS_RATE ?? 0), 0), 1)
