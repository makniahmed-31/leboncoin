import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { MAX_MESSAGE_LENGTH } from '../schemas'
import { MessageComposer } from './message-composer'

type SendResult = { ok: true } | { ok: false; error: string }
type SendHandler = (body: string) => SendResult

const ok: SendHandler = () => ({ ok: true })

function setup(onSend: ReturnType<typeof vi.fn<SendHandler>> = vi.fn(ok)) {
  const utils = renderWithProviders(
    <MessageComposer conversationId={1} counterpartName="Jeremie" onSend={onSend} />
  )
  return { ...utils, onSend, textarea: screen.getByLabelText('Message a Jeremie') }
}

describe('MessageComposer', () => {
  it('sends on Enter and clears the field', async () => {
    const { user, onSend, textarea } = setup()

    await user.type(textarea, 'Bonjour')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('Bonjour')
    expect(textarea).toHaveValue('')
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const { user, onSend, textarea } = setup()

    await user.type(textarea, 'premiere ligne')
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    await user.type(textarea, 'seconde ligne')

    expect(onSend).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('premiere ligne\nseconde ligne')
  })

  it('keeps focus in the field after sending, so a reply can follow immediately', async () => {
    const { user, textarea } = setup()

    await user.type(textarea, 'Bonjour')
    await user.keyboard('{Enter}')

    expect(textarea).toHaveFocus()
  })

  it('refuses to send an empty or whitespace-only message', async () => {
    const { user, onSend, textarea } = setup()
    const send = screen.getByRole('button', { name: 'Envoyer le message' })

    expect(send).toBeDisabled()

    await user.type(textarea, '   ')
    expect(send).toBeDisabled()

    await user.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('surfaces a rejection from the send handler as an alert tied to the field', async () => {
    const onSend = vi.fn<SendHandler>(() => ({
      ok: false,
      error: 'Le message ne peut pas etre vide.',
    }))
    const { user, textarea } = setup(onSend)

    await user.type(textarea, 'Bonjour')
    await user.keyboard('{Enter}')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Le message ne peut pas etre vide.')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea.getAttribute('aria-describedby')).toContain(alert.id)
    // The text is kept, not thrown away, so the user can correct it.
    expect(textarea).toHaveValue('Bonjour')
  })

  it('announces the remaining characters only as the limit approaches', async () => {
    const { user, textarea } = setup()

    await user.click(textarea)
    expect(screen.queryByText(/caracteres restants/)).not.toBeInTheDocument()

    await user.paste('a'.repeat(MAX_MESSAGE_LENGTH - 10))
    expect(screen.getByText('10 caracteres restants')).toBeInTheDocument()
  })

  it('blocks sending past the limit', async () => {
    const { user, textarea, onSend } = setup()

    await user.click(textarea)
    await user.paste('a'.repeat(MAX_MESSAGE_LENGTH + 1))

    expect(screen.getByRole('button', { name: 'Envoyer le message' })).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps a draft per conversation', async () => {
    const { user, textarea, unmount } = setup()
    await user.type(textarea, 'brouillon')
    unmount()

    renderWithProviders(
      <MessageComposer conversationId={1} counterpartName="Jeremie" onSend={vi.fn(ok)} />
    )
    expect(screen.getByLabelText('Message a Jeremie')).toHaveValue('brouillon')

    renderWithProviders(
      <MessageComposer conversationId={2} counterpartName="Patrick" onSend={vi.fn(ok)} />
    )
    expect(screen.getByLabelText('Message a Patrick')).toHaveValue('')
  })
})
