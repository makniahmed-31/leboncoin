import 'server-only'

import { ApiError } from './api-error'
import { CHAOS_RATE } from './env'

/**
 * Fails a proportion of calls to the API, on demand.
 *
 * A degraded backend is a state the interface has to handle, and the only honest way to check
 * that it does is to produce one. Injecting it here rather than in the route handlers matters:
 * server-rendered pages fetch their first data before the browser is involved, so a failure
 * mocked in the browser would never reach them — and that path is precisely where a dead backend
 * turns into a blank screen instead of an error state.
 *
 *   CHAOS_RATE=0.3 pnpm dev    one call in three fails
 *   CHAOS_RATE=1   pnpm dev    a total outage
 */
export function maybeFail() {
  if (CHAOS_RATE > 0 && Math.random() < CHAOS_RATE) {
    throw ApiError.unavailable()
  }
}
