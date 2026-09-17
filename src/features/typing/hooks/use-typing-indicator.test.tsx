import { render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LiveProvider } from '@/shared/live/live-provider'
import { latestEventSource, resetEventSources } from '@/test/event-source'

import { useTypingConversations, useTypingIndicator } from './use-typing-indicator'

function Indicator({ conversationId }: { conversationId: number }) {
  return <span data-testid="typing">{useTypingIndicator(conversationId) ? 'yes' : 'no'}</span>
}

const renderIndicator = (conversationId = 7) =>
  render(
    <LiveProvider enabled>
      <Indicator conversationId={conversationId} />
    </LiveProvider>
  )

const typing = () => screen.getByTestId('typing').textContent

function Inbox() {
  const conversations = useTypingConversations()
  return <span data-testid="inbox">{[...conversations].toSorted((a, b) => a - b).join(',')}</span>
}

const renderInbox = () =>
  render(
    <LiveProvider enabled>
      <Inbox />
    </LiveProvider>
  )

const inbox = () => screen.getByTestId('inbox').textContent

/** Pushes a typing frame down the open stream, as the API would frame it. */
const emitTyping = async (options: { conversationId: number; userId: number; typing: boolean }) => {
  await act(async () => {
    latestEventSource()?.emit({ type: 'typing.changed', ...options })
  })
}

/**
 * The expiry is the part worth pinning, because it is what stands between a working indicator and
 * one that is stuck on forever.
 *
 * The sender posts `false` when they send, and that path is easy. Every other way a member stops
 * typing — closing the laptop, losing signal, walking away — produces no event at all, so an
 * indicator that waited for one would never go out. These tests are about the silence.
 */
describe('the typing indicator', () => {
  beforeEach(() => {
    resetEventSources()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lights up for a ping in this conversation', async () => {
    renderIndicator(7)
    await act(async () => {})

    await emitTyping({ conversationId: 7, userId: 3, typing: true })

    expect(typing()).toBe('yes')
  })

  it('ignores a ping for a different conversation', async () => {
    renderIndicator(7)
    await act(async () => {})

    await emitTyping({ conversationId: 8, userId: 3, typing: true })

    expect(typing()).toBe('no')
  })

  it('goes out on its own when the pings stop', async () => {
    renderIndicator(7)
    await act(async () => {})
    await emitTyping({ conversationId: 7, userId: 3, typing: true })
    expect(typing()).toBe('yes')

    // No stop event is ever sent — this is the laptop-lid case, and the only thing that can
    // clear it is the client's own timeout.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_500)
    })

    expect(typing()).toBe('no')
  })

  it('keeps burning while pings keep arriving', async () => {
    renderIndicator(7)
    await act(async () => {})
    await emitTyping({ conversationId: 7, userId: 3, typing: true })

    // Three windows, each refreshed just before it lapses: a member typing a long message must
    // not flicker.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000)
      })
      await emitTyping({ conversationId: 7, userId: 3, typing: true })
      expect(typing()).toBe('yes')
    }
  })

  it('goes out at once when the sender says they stopped', async () => {
    renderIndicator(7)
    await act(async () => {})
    await emitTyping({ conversationId: 7, userId: 3, typing: true })

    await emitTyping({ conversationId: 7, userId: 3, typing: false })

    expect(typing()).toBe('no')
  })

  /**
   * Two people typing must not go dark when the first of them stops — the naive boolean version
   * of this hook does exactly that, and it only shows up once a thread has three participants.
   */
  it('stays lit until the last person stops', async () => {
    renderIndicator(7)
    await act(async () => {})

    await emitTyping({ conversationId: 7, userId: 3, typing: true })
    await emitTyping({ conversationId: 7, userId: 4, typing: true })

    await emitTyping({ conversationId: 7, userId: 3, typing: false })
    expect(typing()).toBe('yes')

    await emitTyping({ conversationId: 7, userId: 4, typing: false })
    expect(typing()).toBe('no')
  })

  /**
   * The case the thread's own indicator cannot cover, and the one that actually matters: a member
   * sitting in their inbox, not looking at any thread, needs to see that somebody is writing to
   * them. The first version of this hook filtered events down to the open conversation, so the
   * only person who could see the dots was one already watching the reply arrive.
   */
  describe('across the whole inbox', () => {
    it('reports typing in a conversation nobody has open', async () => {
      renderInbox()
      await act(async () => {})

      await emitTyping({ conversationId: 12, userId: 3, typing: true })

      expect(inbox()).toBe('12')
    })

    it('tracks several conversations at once', async () => {
      renderInbox()
      await act(async () => {})

      await emitTyping({ conversationId: 12, userId: 3, typing: true })
      await emitTyping({ conversationId: 30, userId: 9, typing: true })
      expect(inbox()).toBe('12,30')

      await emitTyping({ conversationId: 12, userId: 3, typing: false })
      expect(inbox()).toBe('30')
    })

    it('drops a conversation once its last typist expires', async () => {
      renderInbox()
      await act(async () => {})
      await emitTyping({ conversationId: 12, userId: 3, typing: true })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_500)
      })

      expect(inbox()).toBe('')
    })

    it('clears everything when the stream drops, since no stop can arrive', async () => {
      renderInbox()
      await act(async () => {})
      await emitTyping({ conversationId: 12, userId: 3, typing: true })

      await act(async () => {
        latestEventSource()?.failFatally()
      })

      expect(inbox()).toBe('')
    })
  })
})
