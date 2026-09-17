'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { ConnectionStatus, MessageTransport, TransportEvent } from '@/lib/transport'
import { createTransport } from '@/lib/transport'

type LiveContextValue = {
  status: ConnectionStatus
  watch: (conversationId: number | null) => void
  subscribe: (listener: (event: TransportEvent) => void) => () => void
}

const LiveContext = createContext<LiveContextValue | null>(null)

/**
 * Holds the single transport instance for the app.
 *
 * This is one of the two providers in the tree, and it earns its place the same way the query
 * client does: it is one long-lived connection that several unrelated screens need to share.
 * Business state stays out of it — it exposes a status and a subscription, and the features
 * decide what an event means for their own caches.
 */
export function LiveProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode
  enabled?: boolean
}) {
  const [status, setStatus] = useState<ConnectionStatus>(enabled ? 'connecting' : 'idle')
  const transportRef = useRef<MessageTransport | null>(null)

  if (transportRef.current === null) {
    transportRef.current = createTransport()
  }

  /*
   * Nothing is opened without a session, and that is a correctness rule rather than an
   * optimisation.
   *
   * `/api/events` answers 401 with no session, which EventSource treats as fatal — so the
   * transport reports it as offline and reopens with backoff, exactly as it should for a 503.
   * It cannot tell the two apart, because an EventSource error carries no status. On a page
   * where authentication is the thing the visitor has not done yet, that retry can never
   * succeed, so it would be an unbounded series of 401s behind the login form. The provider
   * still wraps the whole tree, so `useLive` works everywhere; it simply does not connect.
   */
  useEffect(() => {
    if (!enabled) return

    const transport = transportRef.current
    if (!transport) return

    const unsubscribe = transport.subscribe((event) => {
      if (event.type === 'status') setStatus(event.status)
    })
    transport.connect()

    return () => {
      unsubscribe()
      transport.disconnect()
    }
  }, [enabled])

  const value = useMemo<LiveContextValue>(
    () => ({
      status,
      watch: (conversationId) => transportRef.current?.watch(conversationId),
      subscribe: (listener) => transportRef.current?.subscribe(listener) ?? (() => {}),
    }),
    [status]
  )

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive() {
  const value = useContext(LiveContext)
  if (!value) throw new Error('useLive must be used inside LiveProvider')
  return value
}

/** Subscribes to one kind of transport event without re-subscribing on every render. */
export function useLiveEvent<T extends TransportEvent['type']>(
  type: T,
  handler: (event: Extract<TransportEvent, { type: T }>) => void
) {
  const { subscribe } = useLive()
  const handlerRef = useRef(handler)

  // Kept in an effect rather than assigned during render: the subscription below is created once
  // and reads the ref when an event fires, so it always sees the latest handler without tearing
  // the subscription down and building it again on every render.
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === type) {
          handlerRef.current(event as Extract<TransportEvent, { type: T }>)
        }
      }),
    [subscribe, type]
  )
}

/** Keeps the transport pointed at the conversation currently on screen. */
export function useWatchConversation(conversationId: number | null) {
  const { watch } = useLive()

  useEffect(() => {
    watch(conversationId)
    return () => watch(null)
  }, [conversationId, watch])
}
