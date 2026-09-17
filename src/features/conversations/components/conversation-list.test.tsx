import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeConversation, makeMessage } from '@/test/factories'
import { failing, seedTestDb } from '@/test/handlers'
import { server } from '@/test/msw-server'
import { renderWithProviders } from '@/test/render'

import { ConversationList } from './conversation-list'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useParams: () => ({ conversationId: '2' }),
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
}))

describe('ConversationList', () => {
  beforeEach(() => {
    seedTestDb({
      conversations: [
        makeConversation({
          id: 1,
          senderId: 1,
          recipientId: 2,
          recipientNickname: 'Jeremie',
          lastMessageTimestamp: 1_700_000_000,
        }),
        makeConversation({
          id: 2,
          senderId: 4,
          senderNickname: 'Elodie',
          recipientId: 1,
          recipientNickname: 'Thibaut',
          lastMessageTimestamp: 1_700_009_000,
        }),
      ],
    })
  })

  it('names the other participant, whichever side of the conversation they are on', async () => {
    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    const list = await screen.findByRole('list', { name: 'Liste des conversations' })
    const rows = within(list).getAllByRole('listitem')

    // Elodie is the sender of conversation 2 and the logged user is the recipient; the list still
    // has to show Elodie, not the logged user's own nickname.
    expect(rows[0]).toHaveTextContent('Elodie')
    expect(rows[1]).toHaveTextContent('Jeremie')
  })

  it('shows the last message under the name, and nothing when there is none', async () => {
    // The preview is a field on the conversation rather than something derived per row. The API
    // writes it inside the same transaction as the message, so the list endpoint reads one column
    // instead of running a "newest message in this thread" query for every row it returns.
    seedTestDb({
      conversations: [
        makeConversation({
          id: 1,
          recipientNickname: 'Jeremie',
          lastMessageTimestamp: 1_700_000,
          preview: 'Ca marche, a demain !',
          lastMessageAuthorId: 2,
        }),
        makeConversation({ id: 2, recipientNickname: 'Patrick', lastMessageTimestamp: 1_600_000 }),
      ],
      messages: [makeMessage({ id: 1, conversationId: 1, body: 'Ca marche, a demain !' })],
    })

    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    const list = await screen.findByRole('list', { name: 'Liste des conversations' })
    const rows = within(list).getAllByRole('listitem')

    expect(rows[0]).toHaveTextContent('Ca marche, a demain !')
    // Conversation 2 has no messages yet, so its row is simply shorter rather than showing an
    // empty second line that makes it look like the preview failed to load.
    expect(rows[1]).toHaveTextContent('Patrick')
    expect(rows[1]).not.toHaveTextContent('Ca marche')
  })

  it('orders the newest conversation first', async () => {
    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    const list = await screen.findByRole('list', { name: 'Liste des conversations' })
    const links = within(list).getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/conversations/2')
    expect(links[1]).toHaveAttribute('href', '/conversations/1')
  })

  it('marks the open conversation as the current page', async () => {
    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    const list = await screen.findByRole('list', { name: 'Liste des conversations' })
    const current = within(list).getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('href', '/conversations/2')
  })

  it('offers a retry when the list cannot be loaded', async () => {
    server.use(failing.listConversations(503))
    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByRole('button', { name: 'Reessayer' })).toBeInTheDocument()
  })

  it('invites the user to start one when there are none', async () => {
    seedTestDb({ conversations: [] })
    renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)

    expect(await screen.findByText('Aucune conversation')).toBeInTheDocument()
  })

  it('opens the new conversation dialog and lists the members', async () => {
    const { user } = renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)
    await screen.findByRole('list', { name: 'Liste des conversations' })

    await user.click(screen.getAllByRole('button', { name: /Nouvelle conversation/ })[0]!)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Nouvelle conversation' })).toBeVisible()
    expect(await within(dialog).findByText('Patrick')).toBeInTheDocument()
  })

  it('navigates to the thread once a conversation has been created', async () => {
    const { user } = renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)
    await screen.findByRole('list', { name: 'Liste des conversations' })

    await user.click(screen.getAllByRole('button', { name: /Nouvelle conversation/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByText('Patrick'))

    expect(push).toHaveBeenCalledWith('/conversations/3')
  })

  it('filters the member list as the user types', async () => {
    const { user } = renderWithProviders(<ConversationList currentUserId={1} nickname="Thibaut" />)
    await screen.findByRole('list', { name: 'Liste des conversations' })

    await user.click(screen.getAllByRole('button', { name: /Nouvelle conversation/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByText('Patrick')

    await user.type(within(dialog).getByLabelText('Rechercher un membre'), 'jer')

    expect(await within(dialog).findByText('Jeremie')).toBeInTheDocument()
    expect(within(dialog).queryByText('Patrick')).not.toBeInTheDocument()
  })
})
