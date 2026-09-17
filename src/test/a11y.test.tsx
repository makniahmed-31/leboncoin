import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { ConversationList } from '@/features/conversations/components/conversation-list'
import { MessageComposer } from '@/features/messages/components/message-composer'

import { renderWithProviders } from './render'

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}))

/**
 * Automated checks catch roughly a third of what WCAG asks for. They are here to stop the obvious
 * regressions — a missing label, a bad contrast pair, an aria attribute on an element that does
 * not take one. Keyboard order and screen reader flow are asserted in the component and
 * end-to-end tests, because a rules engine cannot see them.
 */
describe('accessibility', () => {
  it('has no violations in the conversation list', async () => {
    const { container } = renderWithProviders(
      <ConversationList currentUserId={1} nickname="Thibaut" />
    )
    await screen.findByRole('list', { name: 'Liste des conversations' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no violations in the composer', async () => {
    const { container } = renderWithProviders(
      <MessageComposer conversationId={1} counterpartName="Jeremie" onSend={() => ({ ok: true })} />
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
