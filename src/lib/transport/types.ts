/**
 * `idle` is not a failure: it is the stream deliberately not opened, which is the state on every
 * page reached without a session. It is distinct from `offline` so the banner can stay quiet —
 * telling a visitor on the login screen that the connection was lost would be a lie about a
 * connection that was never attempted.
 */
export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'offline'

export type TransportEvent =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'messages:changed'; conversationId: number }
  | { type: 'conversations:changed' }
  /*
   * Distinct from `messages:changed`, and the distinction is the point.
   *
   * `messages:changed` says a cache is stale and is emitted for the open thread only. This says a
   * specific message arrived, for any thread, and carries who wrote it — which is what a
   * notification sound needs and what a cache invalidation deliberately does not. Folding the two
   * together would mean either playing a sound on every refetch trigger, or teaching the cache
   * layer about audio.
   */
  | { type: 'message:received'; conversationId: number; messageId: number; authorId: number }
  | { type: 'typing:changed'; conversationId: number; userId: number; typing: boolean }
  | { type: 'presence:changed'; userId: number; online: boolean; lastSeenAt?: number }

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
 *
 * Not every implementation can produce every event, and the interface does not pretend otherwise.
 * Typing and presence exist only on a pushed connection — there is nothing to poll for a fact
 * that is never written down — so the polling transport simply never emits them and the features
 * that consume them degrade to absence rather than to error. An interface that demanded them
 * would have forced the fallback to fake them.
 */
export interface MessageTransport {
  connect(): void
  disconnect(): void
  /** Narrows the live stream to a single thread; null while no conversation is open. */
  watch(conversationId: number | null): void
  subscribe(listener: (event: TransportEvent) => void): () => void
}
