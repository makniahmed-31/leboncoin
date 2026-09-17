import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw-server'
import { renderWithProviders } from '@/test/render'

import { LoginForm } from './login-form'

const replace = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}))

/**
 * Two actions over one field, and the reason is the failure modes rather than the happy paths.
 *
 * Signing in and creating an account fail for opposite reasons — one because the pseudonym is
 * unknown, the other because it is taken — and a single button would have to guess which the
 * member meant. Guessing "sign in" is the dangerous direction: with no password on any account,
 * it would hand somebody a stranger's inbox the moment they chose a name already in use.
 */
describe('the login form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const calls: string[] = []

  const acceptBoth = () => {
    calls.length = 0
    server.use(
      http.post('/api/auth/:mode', async ({ params }) => {
        calls.push(String(params.mode))
        return HttpResponse.json({ id: 1, nickname: 'Nouvelle' })
      })
    )
  }

  it('signs in with the pseudonym, and Enter in the field does the same', async () => {
    acceptBoth()
    const { user } = renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Pseudo'), 'Thibaut{Enter}')

    await waitFor(() => expect(calls).toEqual(['login']))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/conversations'))
  })

  it('creates an account from the second action', async () => {
    acceptBoth()
    const { user } = renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Pseudo'), 'Nouvelle')
    await user.click(screen.getByRole('button', { name: 'Creer un compte' }))

    await waitFor(() => expect(calls).toEqual(['register']))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/conversations'))
  })

  it('points an unknown pseudonym at the other button rather than leaving a dead end', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Identifiants invalides.' },
          { status: 401 }
        )
      )
    )
    const { user } = renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Pseudo'), 'Personne{Enter}')

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument()
    expect(await screen.findByText(/existe pas encore/)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('refuses a taken pseudonym instead of signing into somebody else', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json(
          { statusCode: 409, code: 'NICKNAME_TAKEN', message: 'Ce pseudo est deja pris.' },
          { status: 409 }
        )
      )
    )
    const { user } = renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Pseudo'), 'Thibaut')
    await user.click(screen.getByRole('button', { name: 'Creer un compte' }))

    expect(await screen.findByText('Ce pseudo est deja pris.')).toBeInTheDocument()
    // The whole point: no session, no navigation, no stranger's inbox.
    expect(replace).not.toHaveBeenCalled()
  })

  it('will not submit an empty pseudonym', async () => {
    acceptBoth()
    const { user } = renderWithProviders(<LoginForm />)

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(await screen.findByText('Indiquez votre pseudo.')).toBeInTheDocument()
    expect(calls).toEqual([])
  })
})
