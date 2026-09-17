'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { ConnectionStatus, MessageTransport, TransportEvent } from '@/lib/transport'
import { createTransport } from '@/lib/transport'

type LiveContextValue = {
  status: ConnectionStatus
  watch: (conversationId: number | null) => void
  subscribe: (listener: (event: TransportEvent) => void) => () => void
  /** Opts a subtree into the stream and returns its release. See `useEnsureLive`. */
  enable: () => () => void
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

  /*
   * A second way in, because the prop alone was not enough — and the way it failed is worth
   * recording, since nothing about it looked broken.
   *
   * `enabled` is computed in the root layout from the session cookie. Signing in navigates from
   * /login to /conversations on the client, and Next preserves a shared layout across a client
   * navigation: the root layout keeps the payload it rendered for /login, where there was no
   * session yet. `router.refresh()` is meant to cure exactly that, but the `replace` issued
   * immediately after it supersedes the refresh. So the prop stayed `false` for the whole
   * session and no stream was ever opened — every live feature silently dead until the member
   * happened to reload the page, which is precisely the thing nobody does while testing a
   * single-page app.
   *
   * Letting the authenticated subtree assert it instead is what makes this robust: the
   * conversations layout has already redirected anyone without a session, so being rendered
   * inside it is a stronger statement about the session than a flag captured at whatever moment
   * the root layout last ran.
   */
  const [subtreeCount, setSubtreeCount] = useState(0)
  const active = enabled || subtreeCount > 0

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
    if (!active) return

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
  }, [active])

  /*
   * Counted rather than a boolean, because it has to be given back.
   *
   * Signing out navigates to /login, which unmounts the conversations layout and the gate with
   * it — but the provider lives in the root layout and stays mounted. A flag that is only ever
   * set would leave the stream open on the login screen with the cookie gone, which is the
   * unbounded run of 401s this gate exists to avoid in the first place. A count also lets more
   * than one authenticated subtree ask at once without the first to unmount closing the stream
   * out from under the others.
   */
  const enable = useCallback(() => {
    setSubtreeCount((count) => count + 1)
    return () => setSubtreeCount((count) => Math.max(0, count - 1))
  }, [])

  const value = useMemo<LiveContextValue>(
    () => ({
      status,
      watch: (conversationId) => transportRef.current?.watch(conversationId),
      subscribe: (listener) => transportRef.current?.subscribe(listener) ?? (() => {}),
      enable,
    }),
    [status, enable]
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

/**
 * Declares that this part of the tree is behind authentication, so the stream should be open.
 *
 * Idempotent and safe to call from several places at once — it sets a flag that is already set.
 * It is deliberately not called from the login screen or from anything above it: `/api/events`
 * answers 401 without a session and `EventSource` treats that as fatal, so a stream opened there
 * would be an unbounded run of 401s behind the form.
 */
export function useEnsureLive() {
  const { enable } = useLive()

  // The effect's cleanup is the release, so the stream closes when the last authenticated
  // subtree goes away — on sign-out, that is the gate unmounting as /login takes over.
  useEffect(() => enable(), [enable])
}
