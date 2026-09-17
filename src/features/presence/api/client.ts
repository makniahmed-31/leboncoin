import { presenceListSchema } from '@/lib/contracts'

import { apiGet } from '@/lib/api-client'

/**
 * Presence for the members currently on screen.
 *
 * A cold-start read, not a poll. It answers "who is online right now" once, and every change
 * after that arrives on the event stream — so the request count here is one per mounted list
 * rather than one per member per interval.
 */
export function fetchPresence(userIds: number[], signal?: AbortSignal) {
  const params = new URLSearchParams({ userIds: userIds.join(',') })
  return apiGet(`/users/presence?${params}`, presenceListSchema, signal)
}
