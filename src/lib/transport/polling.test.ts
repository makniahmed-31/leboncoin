import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createPollingTransport } from './polling'
import type { TransportEvent } from './types'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
  window.dispatchEvent(new Event(online ? 'online' : 'offline'))
}

describe('polling transport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  afterEach(() => vi.useRealTimers())

  it('emits message ticks only for the watched conversation', () => {
    const transport = createPollingTransport({ messageIntervalMs: 1000 })
    const events: TransportEvent[] = []
    transport.subscribe((event) => events.push(event))

    transport.connect()
    transport.watch(42)
    vi.advanceTimersByTime(3000)

    const ticks = events.filter((event) => event.type === 'messages:changed')
    expect(ticks).toHaveLength(3)
    expect(ticks.every((tick) => tick.conversationId === 42)).toBe(true)

    transport.disconnect()
  })

  it('emits nothing while no conversation is open', () => {
    const transport = createPollingTransport({ messageIntervalMs: 1000 })
    const events: TransportEvent[] = []
    transport.subscribe((event) => events.push(event))

    transport.connect()
    vi.advanceTimersByTime(3000)

    expect(events.filter((event) => event.type === 'messages:changed')).toHaveLength(0)
    transport.disconnect()
  })

  it('stops polling a hidden tab', () => {
    const transport = createPollingTransport({ messageIntervalMs: 1000 })
    const events: TransportEvent[] = []
    transport.subscribe((event) => events.push(event))

    transport.connect()
    transport.watch(1)
    setVisibility('hidden')
    vi.advanceTimersByTime(5000)

    expect(events.filter((event) => event.type === 'messages:changed')).toHaveLength(0)
    transport.disconnect()
  })

  it('catches up immediately when the tab comes back, without waiting out an interval', () => {
    const transport = createPollingTransport({ messageIntervalMs: 60_000 })
    const events: TransportEvent[] = []
    transport.subscribe((event) => events.push(event))

    transport.connect()
    transport.watch(1)
    setVisibility('hidden')
    setVisibility('visible')

    expect(events.filter((event) => event.type === 'messages:changed')).toHaveLength(1)
    transport.disconnect()
  })

  it('reports going offline and coming back', () => {
    const transport = createPollingTransport()
    const statuses: string[] = []
    transport.subscribe((event) => {
      if (event.type === 'status') statuses.push(event.status)
    })

    transport.connect()
    setOnline(false)
    setOnline(true)

    expect(statuses).toEqual(['live', 'offline', 'live'])
    transport.disconnect()
  })

  it('stops emitting once disconnected', () => {
    const transport = createPollingTransport({ messageIntervalMs: 1000 })
    const events: TransportEvent[] = []
    transport.subscribe((event) => events.push(event))

    transport.connect()
    transport.watch(1)
    transport.disconnect()
    vi.advanceTimersByTime(5000)

    expect(events.filter((event) => event.type === 'messages:changed')).toHaveLength(0)
  })
})
