'use client'

import { useCallback, useEffect, useRef } from 'react'

import { signalTypingRequest } from '../api/client'

/**
 * How long one ping vouches for. The receiving side stops showing the dots this long after the
 * last one, so it doubles as the window a lost ping can leave them stale.
 */
const PING_TTL_MS = 6_000

/**
 * At most one ping this often while the member keeps typing. Comfortably inside the TTL above, so
 * a continuously typing member never lets the indicator lapse, and well under the API's global
 * rate limit even for someone typing without pause.
 */
const PING_INTERVAL_MS = 3_000

/**
 * Sends "I am typing" while the member types, and stops when they stop.
 *
 * Throttled rather than debounced, and the difference matters: a debounce fires after the member
 * pauses, which is the moment they have *stopped* typing — the indicator would appear late and
 * for exactly the wrong interval. A throttle sends the first keystroke immediately and then at
 * most one call per window, so the dots appear at once and cost a request every few seconds
 * instead of one per character.
 *
 * The stop is explicit on send and implicit everywhere else. Posting `false` on send makes the
 * dots vanish the instant the message lands, which is the one transition a member would notice;
 * for anything else — a closed tab, a dropped connection, a walk to the kitchen — the receiver's
 * own timeout is the backstop. That is why there is no `beforeunload` handler here: it would be
 * unreliable on mobile and redundant with a timeout that already covers the same case.
 */
export function useTypingSignal(conversationId: number) {
  const lastSentAt = useRef(0)
  const isTyping = useRef(false)

  /*
   * One effect per thread, doing both halves of the handover.
   *
   * On the way in it clears the throttle window, so the first keystroke in the new thread pings
   * immediately instead of inheriting the previous thread's timer. On the way out it posts the
   * stop for the thread that was open — captured in the closure, because reading the current
   * value at teardown would clear the indicator in the conversation the member just moved *to*.
   */
  useEffect(() => {
    lastSentAt.current = 0
    isTyping.current = false

    return () => {
      if (!isTyping.current) return
      isTyping.current = false
      void signalTypingRequest(conversationId, false).catch(() => {})
    }
  }, [conversationId])

  const ping = useCallback(() => {
    const now = Date.now()
    if (now - lastSentAt.current < PING_INTERVAL_MS) return

    lastSentAt.current = now
    isTyping.current = true
    void signalTypingRequest(conversationId, true).catch(() => {})
  }, [conversationId])

  const stop = useCallback(() => {
    if (!isTyping.current) return

    isTyping.current = false
    lastSentAt.current = 0
    void signalTypingRequest(conversationId, false).catch(() => {})
  }, [conversationId])

  return { ping, stop }
}

export { PING_TTL_MS }
