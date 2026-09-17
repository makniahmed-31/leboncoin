import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { makeMessage } from '@/test/factories'
import { db, failing, seedTestDb } from '@/test/handlers'
import { server } from '@/test/msw-server'
import { renderWithProviders } from '@/test/render'

import { MessageThread } from './message-thread'

const COUNTERPART = { id: 2, nickname: 'Jeremie' }

/**
 * jsdom reports every element as zero-sized, and a virtualizer asked to fill zero pixels renders
 * nothing at all. The scroll container is sized through offsetHeight, which is what the
 * virtualizer reads for the viewport, and the rows through getBoundingClientRect, which is what
 * it falls back to when measuring them. Real geometry is covered by the end-to-end tests, in a
 * browser that has some.
 */
const VIEWPORT_HEIGHT = 800
const ROW_HEIGHT = 72

function giveElementsSize() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => VIEWPORT_HEIGHT,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 600,
  })
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width: 600,
      height: ROW_HEIGHT,
      top: 0,
      left: 0,
      bottom: ROW_HEIGHT,
      right: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
}

function renderThread() {
  return renderWithProviders(
    <MessageThread conversationId={1} currentUserId={1} counterpart={COUNTERPART} />
  )
}

describe('MessageThread', () => {
  beforeEach(() => {
    giveElementsSize()
    seedTestDb({
      messages: [
        makeMessage({ id: 1, authorId: 2, body: "Bonjour, l'annonce est toujours dispo ?" }),
        makeMessage({ id: 2, authorId: 1, body: 'Oui, elle est disponible.' }),
      ],
    })
  })

  it('renders the thread in chronological order', async () => {
    renderThread()

    const list = await screen.findByRole('list', { name: 'Messages avec Jeremie' })
    const bubbles = within(list).getAllByRole('listitem')
    expect(bubbles[bubbles.length - 2]).toHaveTextContent("Bonjour, l'annonce est toujours dispo ?")
    expect(bubbles[bubbles.length - 1]).toHaveTextContent('Oui, elle est disponible.')
  })

  it('shows a sent message immediately and keeps it once the server confirms', async () => {
    const { user } = renderThread()
    await screen.findByRole('list', { name: 'Messages avec Jeremie' })

    await user.type(screen.getByLabelText('Message a Jeremie'), 'Je la prends')
    await user.keyboard('{Enter}')

    // Optimistic: on screen before any response has come back.
    expect(await screen.findByText('Je la prends')).toBeInTheDocument()

    await waitFor(() => {
      expect(db.messages.some((message) => message.body === 'Je la prends')).toBe(true)
    })
    await waitFor(() => expect(screen.queryByText('Envoi...')).not.toBeInTheDocument())
    expect(screen.getByText('Je la prends')).toBeInTheDocument()
  })

  it('keeps a failed message on screen with a way to retry it', async () => {
    server.use(failing.sendMessage(500))
    const { user } = renderThread()
    await screen.findByRole('list', { name: 'Messages avec Jeremie' })

    await user.type(screen.getByLabelText('Message a Jeremie'), 'Message perdu')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: /Reessayer/ })).toBeInTheDocument()
    // The text is not thrown away: losing what someone wrote is worse than showing a failure.
    expect(screen.getByText('Message perdu')).toBeInTheDocument()
  })

  it('sends the failed message successfully on retry', async () => {
    server.use(failing.sendMessage(500))
    const { user } = renderThread()
    await screen.findByRole('list', { name: 'Messages avec Jeremie' })

    await user.type(screen.getByLabelText('Message a Jeremie'), 'Deuxieme essai')
    await user.keyboard('{Enter}')

    const retry = await screen.findByRole('button', { name: /Reessayer/ })
    server.resetHandlers()
    await user.click(retry)

    await waitFor(() => {
      expect(db.messages.some((message) => message.body === 'Deuxieme essai')).toBe(true)
    })
    expect(screen.queryByRole('button', { name: /Reessayer/ })).not.toBeInTheDocument()
  })

  it('lets the user discard a message that will not send', async () => {
    server.use(failing.sendMessage(500))
    const { user } = renderThread()
    await screen.findByRole('list', { name: 'Messages avec Jeremie' })

    await user.type(screen.getByLabelText('Message a Jeremie'), 'A supprimer')
    await user.keyboard('{Enter}')

    await user.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(screen.queryByText('A supprimer')).not.toBeInTheDocument()
  })

  it('offers a retry when the thread itself cannot load', async () => {
    server.use(failing.listMessages(503))
    renderThread()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Conversation indisponible')
    expect(within(alert).getByRole('button', { name: 'Reessayer' })).toBeInTheDocument()
  })

  it('invites the first message when the thread is empty', async () => {
    seedTestDb({ messages: [] })
    renderThread()

    expect(await screen.findByText('Aucun message')).toBeInTheDocument()
    expect(screen.getByText(/Ecrivez le premier message a Jeremie/)).toBeInTheDocument()
  })

  it('announces an incoming message but never the user own', async () => {
    seedTestDb({
      messages: [
        makeMessage({ id: 1, authorId: 1, body: 'Oui, elle est disponible.' }),
        makeMessage({ id: 2, authorId: 2, body: 'Parfait, je passe demain.' }),
      ],
    })
    const { user, container } = renderThread()
    await screen.findByRole('list', { name: 'Messages avec Jeremie' })

    const liveRegion = container.querySelector('[aria-live="polite"][aria-atomic="true"]')
    await waitFor(() => {
      expect(liveRegion).toHaveTextContent('Jeremie : Parfait, je passe demain.')
    })

    await user.type(screen.getByLabelText('Message a Jeremie'), 'Ma reponse')
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(db.messages.some((message) => message.body === 'Ma reponse')).toBe(true)
    })

    // Reading back what the user just typed makes a screen reader unusable in a conversation.
    expect(liveRegion).not.toHaveTextContent('Ma reponse')
  })
})
