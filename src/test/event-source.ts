import type { RealtimeEvent } from '@/lib/contracts'

/**
 * jsdom does not implement EventSource, so the application's live transport has nothing to
 * construct and every test that mounts the provider throws on the first render.
 *
 * This is a real stub rather than a no-op: instances register themselves, so a test can push a
 * server event into the running application and assert what the interface does with it. That is
 * the only way to cover the pushed path at this level — an SSE stream cannot be intercepted by
 * MSW the way a fetch can.
 */
class EventSourceStub {
  static readonly instances: EventSourceStub[] = []

  readonly url: string
  readyState = 0

  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>()

  constructor(url: string) {
    this.url = url
    EventSourceStub.instances.push(this)

    // The real implementation connects asynchronously, and a stub that opened synchronously would
    // let a component observe a state the browser never shows it.
    queueMicrotask(() => {
      this.readyState = 1
      this.dispatch('open', new MessageEvent('open'))
    })
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    const set = this.listeners.get(type) ?? new Set()
    set.add(listener)
    this.listeners.set(type, set)
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  close() {
    this.readyState = 2
    this.listeners.clear()
  }

  /**
   * A connection the user agent drops but intends to retry: readyState goes back to CONNECTING
   * and an error fires. This is the case the browser handles on its own.
   */
  dropConnection() {
    this.readyState = 0
    this.dispatch('error', new MessageEvent('error'))
  }

  /**
   * A connection the user agent refuses to retry — a non-2xx status or the wrong content type.
   * readyState is CLOSED and no further attempt is made, which is what `/api/events` produces
   * when it answers 503 or 401.
   */
  failFatally() {
    this.readyState = 2
    this.dispatch('error', new MessageEvent('error'))
  }

  private dispatch(type: string, event: MessageEvent) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as MessageEvent<string>)
    }
  }

  /** Pushes a server event, exactly as the API would frame it. */
  emit(event: RealtimeEvent) {
    this.dispatch(event.type, new MessageEvent(event.type, { data: JSON.stringify(event) }))
  }
}

export function resetEventSources() {
  EventSourceStub.instances.length = 0
}

/** The stream the application opened, for tests that want to push into it. */
export function latestEventSource(): EventSourceStub | undefined {
  return EventSourceStub.instances.at(-1)
}

export { EventSourceStub }
