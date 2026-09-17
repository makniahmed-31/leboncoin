import { realtimeEventSchema } from '@/lib/contracts'

import { Emitter } from './emitter'
import type { ConnectionStatus, MessageTransport, TransportEvent } from './types'

/** EventSource.CLOSED, as a literal: the global carries the constants, an injected stub may not. */
const CLOSED = 2

const MAX_BACKOFF_MS = 30_000

/**
 * The pushed transport, over server-sent events.
 *
 * `EventSource` cannot set headers, which is usually the reason people reach for WebSockets
 * instead — but it does send cookies on a same-origin request, and the session here is an
 * httpOnly cookie on this origin. So authentication needs no special case at all: the stream is
 * authenticated exactly like every other request the browser makes.
 *
 * It reconnects on its own after a dropped connection, with its own backoff, which is a
 * meaningful amount of code not written. It does *not* reconnect after a fatal one — a non-2xx
 * response or the wrong content type makes the user agent fail the connection permanently — and
 * that case has to be handled here, because it is the common one: `/api/events` answers 503 while
 * the API is unreachable and 401 with no session. Both are fatal, so the browser gives up after a
 * single attempt and the stream stays dead for the life of the page.
 *
 * The two are told apart by readyState at the moment of the error, so what the banner shows is
 * what the connection is actually doing rather than an optimistic guess.
 */
export function createSseTransport(url = '/api/events'): MessageTransport {
  const emitter = new Emitter()
  let source: EventSource | null = null
  let watched: number | null = null
  let reopenTimer: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let stopped = true

  const setStatus = (status: ConnectionStatus) => emitter.emit({ type: 'status', status })

  const onServerEvent = (event: MessageEvent<string>) => {
    const parsed = realtimeEventSchema.safeParse(safeJson(event.data))
    // Dropped rather than thrown. During a rolling deploy a new API can push a shape this bundle
    // does not know, and an unrecognised notification should cost a missed refresh, not a
    // crashed listener that stops delivering the ones it does understand.
    if (!parsed.success) return

    const notification = parsed.data

    if (notification.type === 'message.created') {
      /*
       * Only the thread on screen triggers a message refetch. A notification for any other
       * conversation still refreshes the list — that is how its preview line and unread badge
       * move — but fetching the messages of a thread nobody is looking at is pure waste.
       */
      if (watched !== null && notification.conversationId === watched) {
        emitter.emit({ type: 'messages:changed', conversationId: watched })
      }
      emitter.emit({ type: 'conversations:changed' })
      return
    }

    emitter.emit({ type: 'conversations:changed' })
  }

  /**
   * A dropped connection leaves readyState at CONNECTING and the browser retries on its own, so
   * there is nothing to do but report it. A fatal one leaves it at CLOSED, and the browser is
   * finished: without the reopen below, an API that is briefly unreachable costs live updates for
   * the rest of the page's life, and the banner would sit there claiming a retry was in progress.
   */
  const onError = () => {
    if (!source) return

    if (source.readyState !== CLOSED) {
      setStatus(navigator.onLine ? 'connecting' : 'offline')
      return
    }

    source.close()
    source = null
    setStatus('offline')
    scheduleReopen()
  }

  /** Backoff is jittered for the same reason the query client's is: every client watching a
   *  service that just died would otherwise come back at the same instant. */
  const scheduleReopen = () => {
    if (stopped) return

    clearTimeout(reopenTimer)
    const base = Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS)
    attempts += 1

    reopenTimer = setTimeout(
      () => {
        if (stopped) return
        setStatus('connecting')
        open()
      },
      base * (0.5 + Math.random() * 0.5)
    )
  }

  const open = () => {
    source = new EventSource(url)

    source.addEventListener('open', () => {
      attempts = 0
      setStatus('live')
    })

    source.addEventListener('error', onError)

    for (const type of ['message.created', 'conversation.created', 'conversation.read']) {
      source.addEventListener(type, onServerEvent as EventListener)
    }
  }

  return {
    connect() {
      if (!stopped) return
      stopped = false
      attempts = 0
      setStatus('connecting')
      open()
    },

    disconnect() {
      stopped = true
      clearTimeout(reopenTimer)
      reopenTimer = undefined
      source?.close()
      source = null
      emitter.clear()
    },

    watch(conversationId: number | null) {
      watched = conversationId
    },

    subscribe(listener: (event: TransportEvent) => void) {
      return emitter.subscribe(listener)
    },
  }
}

function safeJson(payload: string): unknown {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}
