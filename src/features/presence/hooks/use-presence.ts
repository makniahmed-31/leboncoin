'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { queryKeys } from '@/lib/query-keys'
import { useLiveEvent } from '@/shared/live/live-provider'

import { fetchPresence } from '../api/client'

export type PresenceState = { online: boolean; lastSeenAt?: number }

/**
 * Who, of these members, is online — seeded once over HTTP and kept current by the stream.
 *
 * The two halves are deliberate. A page that only listened to events would show every member as
 * offline until one of them happened to connect or disconnect, which on a quiet afternoon is
 * never; one that only polled would be a request per interval to learn something that changes
 * twice a day. Seeding once and then following changes is the combination that is both correct on
 * arrival and silent afterwards.
 *
 * Live state is held here rather than written back into the query cache. Presence is not a server
 * resource this client owns a copy of — it is a fact that expires — and pushing it through the
 * cache would let a refetch resurrect a member who went offline two seconds ago, because the
 * refetch was already in flight when the event landed.
 */
export function usePresence(userIds: number[]): Map<number, PresenceState> {
  /*
   * Sorted, deduped, and memoised on the resulting string rather than on the array. The caller
   * passes a fresh array on every render — it is derived from the conversation list — so
   * depending on the array itself would rebuild the key, and the query, on each one.
   */
  const key = [...new Set(userIds)].toSorted((a, b) => a - b).join(',')
  const ids = useMemo(() => (key === '' ? [] : key.split(',').map(Number)), [key])

  const { data } = useQuery({
    queryKey: queryKeys.presence(ids),
    queryFn: ({ signal }) => fetchPresence(ids, signal),
    enabled: ids.length > 0,
    /*
     * Presence goes stale the moment it is read, but refetching is not what fixes that — the
     * stream is. A long stale time keeps a remount from re-asking for something the transport has
     * been keeping current, while still re-seeding a genuinely cold cache.
     */
    staleTime: 60_000,
    // A failed presence read costs a grey dot. It must never surface as an error state on a
    // conversation list that is otherwise working.
    retry: 1,
    throwOnError: false,
  })

  const [live, setLive] = useState<Map<number, PresenceState>>(new Map())

  useLiveEvent('presence:changed', (event) => {
    setLive((previous) => {
      const next = new Map(previous)
      next.set(event.userId, { online: event.online, lastSeenAt: event.lastSeenAt })
      return next
    })
  })

  /*
   * A dropped stream invalidates every live fact at once.
   *
   * Without this the last known state persists indefinitely: a member whose connection died at
   * lunchtime keeps rendering green dots for people who left hours ago, because the events that
   * would have turned them grey were never delivered. Clearing back to the seed — and letting the
   * query refetch when the page is used again — is the honest state for "we no longer know".
   */
  useLiveEvent('status', (event) => {
    if (event.status === 'offline') setLive(new Map())
  })

  return useMemo(() => {
    const merged = new Map<number, PresenceState>()

    for (const entry of data ?? []) {
      merged.set(entry.userId, { online: entry.online, lastSeenAt: entry.lastSeenAt })
    }

    // Events win over the seed unconditionally: anything here arrived after the read that
    // produced `data`, including when a refetch has just overwritten it with older truth.
    for (const [userId, state] of live) merged.set(userId, state)

    return merged
  }, [data, live])
}

/** The same thing for a single member, which is what the thread header needs. */
export function usePresenceOf(userId: number): PresenceState {
  const ids = useMemo(() => [userId], [userId])
  return usePresence(ids).get(userId) ?? { online: false }
}
