import { createPollingTransport } from './polling'
import { createSseTransport } from './sse'
import type { MessageTransport } from './types'

export type { ConnectionStatus, MessageTransport, TransportEvent } from './types'
export { createPollingTransport } from './polling'
export { createSseTransport } from './sse'

/**
 * The one place a concrete transport is chosen. Components import the interface, never this.
 *
 * Two implementations exist and both are real, which is what makes the abstraction worth having
 * rather than speculative: the interface was not shaped around whichever one was written first.
 * Switching between them is this environment variable and nothing else — no component, hook or
 * cache interaction changes, because none of them can tell how an event arrived.
 *
 * Polling is a build-time choice, not an automatic degradation — worth stating plainly, because
 * the two are easy to confuse. Nothing here watches the stream and swaps implementations
 * underneath a running page; the SSE transport reopens its own connection when the server refuses
 * one. What the switch is for is the deployment that cannot use a stream at all: some corporate
 * proxies buffer `text/event-stream` into uselessness, and that is a property of the network an
 * instance sits behind rather than something a client can detect and route around.
 */
export function createTransport(): MessageTransport {
  return process.env.NEXT_PUBLIC_TRANSPORT === 'polling'
    ? createPollingTransport()
    : createSseTransport()
}
