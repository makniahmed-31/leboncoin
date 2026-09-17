'use client'

import { useEnsureLive } from './live-provider'

/**
 * Renders nothing and opens the live stream.
 *
 * It exists so a Server Component can make the statement — the conversations layout knows there
 * is a session, because it redirected anyone without one, but it cannot call a hook. Putting the
 * declaration in the layout keeps it next to the redirect it depends on, rather than hidden
 * inside whichever client component happened to be mounted on every authenticated route.
 */
export function LiveGate() {
  useEnsureLive()
  return null
}
