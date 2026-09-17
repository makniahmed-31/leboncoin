export type ConnectionStatus = 'connecting' | 'live' | 'offline'

export type TransportEvent =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'messages:changed'; conversationId: number }
  | { type: 'conversations:changed' }

/**
 * The seam between "new messages arrived" and how the app found out.
 *
 * How the application found out is an implementation detail nothing in the UI is allowed to
 * learn: components subscribe to events, never to an interval or to a socket. Two implementations
 * satisfy this interface — a pushed one over server-sent events and a polling fallback — and
 * choosing between them is one line at the composition root. Nothing downstream changes, which
 * is the property that makes this an abstraction rather than indirection.
 *
 * Writing the pushed one second is what proved the shape: an interface designed around polling
 * would have leaked an interval or a refetch callback into it, and neither appears here.
 */
export interface MessageTransport {
  connect(): void
  disconnect(): void
  /** Narrows the live stream to a single thread; null while no conversation is open. */
  watch(conversationId: number | null): void
  subscribe(listener: (event: TransportEvent) => void): () => void
}
