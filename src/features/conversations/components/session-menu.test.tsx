import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'
import { server } from '@/test/msw-server'
import { useComposerStore } from '@/stores/composer-store'
import { useOutboxStore } from '@/stores/outbox-store'

import { SessionMenu } from './session-menu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

/**
 * Signing out has to take the local state with it.
 *
 * Drafts are persisted to localStorage, so they outlive the browser session rather than merely
 * the render — and two members who share a device also share any conversation they are both in,
 * which is precisely where a left-behind draft reappears. With the demo's named accounts that is
 * a reviewer signing in as one person, typing, signing out, and reading their own words back as
 * somebody else.
 */
describe('signing out', () => {
  it('clears drafts, the outbox and the query cache', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })))

    useComposerStore.getState().setDraft(42, 'un brouillon a moitie ecrit')
    expect(useComposerStore.getState().drafts[42]).toBe('un brouillon a moitie ecrit')

    // Not persisted, but a module singleton — and signing out is a client navigation, so it
    // outlives the member who queued it unless something says otherwise.
    useOutboxStore.getState().enqueue({
      clientId: 'abc',
      conversationId: 42,
      body: 'jamais parti',
      timestamp: 0,
      status: 'failed',
    })
    expect(useOutboxStore.getState().entries).toHaveLength(1)

    const { user, queryClient, getByRole } = renderWithProviders(
      <SessionMenu nickname="Thibaut" userId={1} />
    )

    queryClient.setQueryData(['conversations'], [{ id: 42 }])

    await user.click(getByRole('button', { name: /Se deconnecter/ }))

    await waitFor(() => {
      expect(useComposerStore.getState().drafts).toEqual({})
    })
    expect(useOutboxStore.getState().entries).toEqual([])
    expect(queryClient.getQueryData(['conversations'])).toBeUndefined()
  })
})
