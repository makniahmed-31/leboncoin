'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useLiveEvent } from '@/shared/live/live-provider'

import { PING_TTL_MS } from './use-typing-signal'

/** conversationId -> (userId -> the moment their last ping stops vouching for them). */
type Typists = Map<number, Map<number, number>>

/**
 * Who is typing, everywhere, with each entry expiring on its own.
 *
 * Tracked across every conversation rather than only the open one, because the member who most
 * needs to know that somebody is writing to them is the one looking at their inbox rather than at
 * the thread. Scoping this to the open conversation — which is what it did first — meant the
 * indicator was only ever visible to someone already watching the reply arrive.
 *
 * The expiry is the part that makes it honest. The sender posts `false` when they send, but every
 * other way of stopping — closing the laptop, losing signal, wandering off — produces no event at
 * all, so anything waiting for one would stay lit forever. Each ping vouches for a few seconds
 * and the dots go out by themselves when the pings stop.
 *
 * Held per member within each conversation, so a thread with a third participant stays lit until
 * the last of them stops rather than the first.
 */
function useTypists(): Typists {
  const [typists, setTypists] = useState<Typists>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useLiveEvent('typing:changed', (event) => {
    setTypists((previous) => {
      const next = new Map(previous)
      const inConversation = new Map(next.get(event.conversationId) ?? [])

      if (event.typing) inConversation.set(event.userId, Date.now() + PING_TTL_MS)
      else inConversation.delete(event.userId)

      // Emptied conversations are dropped rather than left as empty maps, so `size` alone answers
      // "is anybody typing here" and the timer below has nothing dead to walk over.
      if (inConversation.size === 0) next.delete(event.conversationId)
      else next.set(event.conversationId, inConversation)

      return next
    })
  })

  /*
   * A dropped stream invalidates every one of these at once. The stop events that would have
   * cleared them cannot arrive over a connection that is gone, so holding the last known state
   * would leave dots burning under threads nobody is writing in.
   */
  useLiveEvent('status', (event) => {
    if (event.status === 'offline') setTypists(new Map())
  })

  /*
   * One timer for the soonest expiry, rescheduled whenever the set changes, rather than one timer
   * per typist or an interval ticking every second. An interval would re-render an idle inbox
   * sixty times a minute to discover that nothing had expired; this wakes exactly once, when
   * something does.
   */
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (typists.size === 0) return

    let soonest = Number.POSITIVE_INFINITY
    for (const members of typists.values()) {
      for (const expiresAt of members.values()) {
        if (expiresAt < soonest) soonest = expiresAt
      }
    }

    const delay = Math.max(0, soonest - Date.now())

    timerRef.current = setTimeout(() => {
      const now = Date.now()

      setTypists((previous) => {
        const next: Typists = new Map()
        let dropped = 0

        for (const [conversationId, members] of previous) {
          const live = new Map([...members].filter(([, expiresAt]) => expiresAt > now))
          dropped += members.size - live.size
          if (live.size > 0) next.set(conversationId, live)
        }

        // Returning the identical map when nothing expired is what stops this from looping: a new
        // instance would re-run the effect, reschedule, and fire again immediately.
        return dropped === 0 ? previous : next
      })
    }, delay)

    return () => clearTimeout(timerRef.current)
  }, [typists])

  return typists
}

/** The conversations where somebody else is currently typing. For the inbox list. */
export function useTypingConversations(): Set<number> {
  const typists = useTypists()
  return useMemo(() => new Set(typists.keys()), [typists])
}

/** Whether anyone else is typing in one conversation. For the open thread and its header. */
export function useTypingIndicator(conversationId: number): boolean {
  return useTypists().has(conversationId)
}
