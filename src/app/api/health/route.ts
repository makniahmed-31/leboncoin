import { NextResponse } from 'next/server'

import { API_URL } from '@/lib/env'
import { route } from '@/lib/route-handler'

/**
 * The web tier's own liveness, plus whether it can see the API.
 *
 * Deliberately not a pass-through of the API's health: this answers "is the web container
 * serving", which is what its own orchestrator probe needs. The API's reachability is reported
 * alongside rather than folded into the status, because the application still renders a usable
 * error state when the API is down, and a container that is working as designed should not be
 * restarted for it.
 */
export const GET = route(async () => {
  let api: 'up' | 'down' = 'down'

  try {
    const response = await fetch(`${API_URL.replace(/\/api$/, '')}/health/live`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    })
    if (response.ok) api = 'up'
  } catch {
    // Reported below, not thrown: see above.
  }

  return NextResponse.json({ status: 'ok', api, uptimeSeconds: Math.floor(process.uptime()) })
})
