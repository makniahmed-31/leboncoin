import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EventSourceStub } from '@/test/event-source'

import { LiveGate } from './live-gate'
import { LiveProvider, useLive } from './live-provider'

function Status() {
  return <span data-testid="status">{useLive().status}</span>
}

/**
 * The gate exists because `EventSource` cannot see why a connection failed.
 *
 * `/api/events` answers 401 without a session, which the user agent treats as fatal exactly as it
 * treats the 503 an unreachable API produces — and the transport, unable to tell them apart,
 * reopens with backoff. That is right for the outage and wrong for the login screen, where the
 * retry can never succeed: it would be an unbounded run of 401s behind the form. So the provider
 * is told whether a session exists, by the only side that can read the cookie.
 */
describe('the live provider', () => {
  it('opens no stream at all when there is no session', () => {
    render(
      <LiveProvider enabled={false}>
        <Status />
      </LiveProvider>
    )

    expect(EventSourceStub.instances).toHaveLength(0)
    // Not "offline": nothing was attempted, and the banner must not claim a lost connection.
    expect(screen.getByTestId('status')).toHaveTextContent('idle')
  })

  it('opens exactly one stream when there is', () => {
    render(
      <LiveProvider enabled>
        <Status />
      </LiveProvider>
    )

    expect(EventSourceStub.instances).toHaveLength(1)
    expect(EventSourceStub.instances[0]?.url).toBe('/api/events')
  })

  /**
   * The regression this exists for.
   *
   * `enabled` is computed in the root layout from the session cookie, and signing in navigates to
   * /conversations on the client — where Next preserves the shared root layout, still holding the
   * payload it rendered for /login with no session. The flag therefore stayed false for the whole
   * session and no stream was ever opened: typing indicators, presence and the notification sound
   * were all silently dead until the member reloaded the page by hand.
   *
   * So the authenticated subtree gets to assert it, and that is what these pin.
   */
  it('opens a stream when the authenticated subtree asks for one, despite a stale flag', () => {
    render(
      <LiveProvider enabled={false}>
        <LiveGate />
        <Status />
      </LiveProvider>
    )

    expect(EventSourceStub.instances).toHaveLength(1)
    expect(screen.getByTestId('status')).not.toHaveTextContent('idle')
  })

  it('still opens exactly one stream when both the flag and the subtree agree', () => {
    render(
      <LiveProvider enabled>
        <LiveGate />
        <Status />
      </LiveProvider>
    )

    // The gate sets a flag that is already set, so it must not cost a second connection.
    expect(EventSourceStub.instances).toHaveLength(1)
  })

  /**
   * The gate has to be given back as well as taken.
   *
   * Signing out navigates to /login, which unmounts the conversations layout and the gate inside
   * it — but the provider lives in the root layout and stays. A flag that is only ever set would
   * leave the stream open on the login screen with the cookie already cleared, which is the run
   * of 401s the gate exists to prevent.
   */
  it('closes the stream when the authenticated subtree unmounts', () => {
    const { rerender } = render(
      <LiveProvider enabled={false}>
        <LiveGate />
      </LiveProvider>
    )

    expect(EventSourceStub.instances).toHaveLength(1)
    expect(EventSourceStub.instances[0]?.readyState).not.toBe(2)

    rerender(
      <LiveProvider enabled={false}>
        <span />
      </LiveProvider>
    )

    // 2 === CLOSED.
    expect(EventSourceStub.instances[0]?.readyState).toBe(2)
  })
})
