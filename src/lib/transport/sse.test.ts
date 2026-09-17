import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { latestEventSource, resetEventSources } from '@/test/event-source'

import { createSseTransport } from './sse'
import type { TransportEvent } from './types'

/**
 * The fatal-error path is the one worth pinning.
 *
 * `EventSource` retries a dropped connection on its own, so that case needs no code and no test.
 * It does not retry a fatal one — a non-2xx response makes the user agent fail the connection for
 * good — and `/api/events` answers 503 whenever the API is unreachable. Without the reopen these
 * tests cover, a backend that blinks costs live updates for the rest of the page's life while the
 * banner claims a retry is in progress.
 */
const statuses = (events: TransportEvent[]) =>
  events.flatMap((event) => (event.type === 'status' ? [event.status] : []))

/** An open transport and the events it has emitted, for the translation tests below. */
const connect = async () => {
  const events: TransportEvent[] = []
  const transport = createSseTransport()
  transport.subscribe((event) => events.push(event))
  transport.connect()
  await vi.advanceTimersByTimeAsync(0)
  return { events, transport }
}

describe('the pushed transport', () => {
  beforeEach(() => {
    resetEventSources()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports connecting, then live, once the stream opens', async () => {
    const events: TransportEvent[] = []
    const transport = createSseTransport()
    transport.subscribe((event) => events.push(event))

    transport.connect()
    await vi.advanceTimersByTimeAsync(0)

    expect(statuses(events)).toEqual(['connecting', 'live'])
    transport.disconnect()
  })

  it('leaves a dropped connection to the browser and only reports it', async () => {
    const events: TransportEvent[] = []
    const transport = createSseTransport()
    transport.subscribe((event) => events.push(event))

    transport.connect()
    await vi.advanceTimersByTimeAsync(0)
    const opened = latestEventSource()

    opened?.dropConnection()

    expect(statuses(events).at(-1)).toBe('connecting')
    // No second stream: retrying is the user agent's job while readyState is CONNECTING.
    expect(latestEventSource()).toBe(opened)

    transport.disconnect()
  })

  it('reopens the stream itself after a fatal error, and reports it as offline meanwhile', async () => {
    const events: TransportEvent[] = []
    const transport = createSseTransport()
    transport.subscribe((event) => events.push(event))

    transport.connect()
    await vi.advanceTimersByTimeAsync(0)
    const first = latestEventSource()

    first?.failFatally()

    // The browser has given up, so the status is not an optimistic "connecting".
    expect(statuses(events).at(-1)).toBe('offline')
    expect(latestEventSource()).toBe(first)

    // Backoff is jittered, so the first attempt lands somewhere in [500ms, 1000ms].
    await vi.advanceTimersByTimeAsync(1_000)

    const second = latestEventSource()
    expect(second).not.toBe(first)

    await vi.advanceTimersByTimeAsync(0)
    expect(statuses(events).at(-1)).toBe('live')

    transport.disconnect()
  })

  it('stops reopening once disconnected', async () => {
    const transport = createSseTransport()
    transport.connect()
    await vi.advanceTimersByTimeAsync(0)

    latestEventSource()?.failFatally()
    transport.disconnect()

    const afterDisconnect = latestEventSource()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(latestEventSource()).toBe(afterDisconnect)
  })

  /**
   * The translation from wire events to transport events is where a whole feature can go quietly
   * missing: an event name the server sends and this file does not listen for is not an error
   * anywhere, it simply never arrives. These pin the three that carry the live decorations.
   */
  describe('translating server events', () => {
    it('reports an arriving message with its author, for any conversation', async () => {
      const { events, transport } = await connect()
      // Deliberately not the watched thread: the sound exists for the conversation the member is
      // not looking at, so this must be emitted with no `watch` call at all.
      latestEventSource()?.emit({
        type: 'message.created',
        conversationId: 7,
        messageId: 99,
        authorId: 3,
        timestamp: 1_700_000_000,
      })

      expect(events).toContainEqual({
        type: 'message:received',
        conversationId: 7,
        messageId: 99,
        authorId: 3,
      })

      transport.disconnect()
    })

    it('relays typing without invalidating the conversation list', async () => {
      const { events, transport } = await connect()
      latestEventSource()?.emit({
        type: 'typing.changed',
        conversationId: 7,
        userId: 3,
        typing: true,
      })

      expect(events).toContainEqual({
        type: 'typing:changed',
        conversationId: 7,
        userId: 3,
        typing: true,
      })

      // The point of the early return in the handler. Falling through would turn every keystroke
      // on the other end into a refetch of the whole list.
      expect(events.some((event) => event.type === 'conversations:changed')).toBe(false)

      transport.disconnect()
    })

    it('relays presence, carrying lastSeenAt when the member left', async () => {
      const { events, transport } = await connect()
      latestEventSource()?.emit({
        type: 'presence.changed',
        userId: 3,
        online: false,
        lastSeenAt: 1_700_000_000,
      })

      expect(events).toContainEqual({
        type: 'presence:changed',
        userId: 3,
        online: false,
        lastSeenAt: 1_700_000_000,
      })
      expect(events.some((event) => event.type === 'conversations:changed')).toBe(false)

      transport.disconnect()
    })
  })
})
