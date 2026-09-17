import { Emitter } from './emitter'
import type { ConnectionStatus, MessageTransport, TransportEvent } from './types'

type Options = {
  messageIntervalMs?: number
  conversationIntervalMs?: number
}

/**
 * Polling stand-in for a pushed transport.
 *
 * Two intervals rather than one: an open thread needs to feel live, the conversation list does
 * not, and polling a 60-item list as often as a single thread would triple the request count for
 * no perceptible gain. Both pause when the tab is hidden, which matters more than it sounds —
 * a background tab left open all afternoon otherwise keeps asking.
 */
export function createPollingTransport(options: Options = {}): MessageTransport {
  const messageIntervalMs = options.messageIntervalMs ?? 5_000
  const conversationIntervalMs = options.conversationIntervalMs ?? 20_000

  const emitter = new Emitter()
  let messageTimer: ReturnType<typeof setInterval> | undefined
  let conversationTimer: ReturnType<typeof setInterval> | undefined
  let watched: number | null = null
  let connected = false

  const setStatus = (status: ConnectionStatus) => emitter.emit({ type: 'status', status })

  const isActive = () =>
    connected &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    navigator.onLine

  const tickMessages = () => {
    if (!isActive() || watched === null) return
    emitter.emit({ type: 'messages:changed', conversationId: watched })
  }

  const tickConversations = () => {
    if (!isActive()) return
    emitter.emit({ type: 'conversations:changed' })
  }

  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return
    // Catch up immediately on return rather than waiting out a whole interval.
    tickMessages()
    tickConversations()
  }

  const onOnline = () => {
    setStatus('live')
    tickMessages()
    tickConversations()
  }

  const onOffline = () => setStatus('offline')

  return {
    connect() {
      if (connected) return
      connected = true
      setStatus(navigator.onLine ? 'live' : 'offline')

      messageTimer = setInterval(tickMessages, messageIntervalMs)
      conversationTimer = setInterval(tickConversations, conversationIntervalMs)
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
    },

    disconnect() {
      connected = false
      clearInterval(messageTimer)
      clearInterval(conversationTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
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
