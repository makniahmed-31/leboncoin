'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

import { ApiError } from '@/lib/api-error'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'

type Fields = { nickname: string }
type Mode = 'login' | 'register'

/**
 * The one form in the application, and the one place React Hook Form earns its place.
 *
 * It is worth saying where it is deliberately absent: the message composer is a single textarea
 * whose only rule is a length check already shared with the API, and wrapping that in a form
 * library would add a dependency to the hot path of the product for no validation the schema is
 * not already doing. A form with fields, submission state and per-field errors is a different
 * problem, and this is it.
 *
 * Two actions over one field, rather than two screens or a toggle. The field is identical for
 * both and a pseudonym is the whole of the identity, so a separate sign-up route would be the
 * same input under a different heading. What the two buttons buy is that the choice is explicit:
 * signing in and creating an account fail for opposite reasons, and a single button would have to
 * guess which the member meant — guessing "sign in" hands somebody a stranger's inbox the moment
 * they pick a name that is already taken.
 */
export function LoginForm() {
  const router = useRouter()
  const [failure, setFailure] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [pending, setPending] = useState<Mode | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Fields>({ defaultValues: { nickname: '' } })

  const submit = (mode: Mode) =>
    handleSubmit(async ({ nickname }) => {
      setFailure(null)
      setHint(null)
      setPending(mode)

      try {
        const response = await fetch(`/api/auth/${mode}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nickname: nickname.trim() }),
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            message?: string
            code?: string
          } | null

          setFailure(body?.message ?? 'Une erreur est survenue.')

          /*
           * The two failures point at each other, because each one is usually the other button.
           * Somebody who mistypes an existing name and somebody who has not signed up yet reach
           * the identical 401, and the only thing separating them is which action they wanted.
           */
          if (mode === 'login' && body?.code === 'UNAUTHENTICATED') {
            setHint('Ce pseudo n’existe pas encore. Creez-le avec "Creer un compte".')
          }
          if (mode === 'register' && body?.code === 'NICKNAME_TAKEN') {
            setHint('Si ce pseudo est le votre, utilisez "Se connecter".')
          }

          return
        }

        /*
         * `refresh` before `replace`, and both are needed.
         *
         * The session lives in an httpOnly cookie that the server reads during rendering, so the
         * cached Server Component payload for the destination was produced without one.
         * Navigating without refreshing would render the logged-out version of a page the user is
         * now authenticated for.
         *
         * It is not sufficient on its own, and that is worth knowing rather than rediscovering:
         * the replace supersedes the refresh, so the root layout can keep the payload it rendered
         * for this page. Anything that must react to the session appearing — the event stream —
         * asserts it from inside the authenticated tree instead. See `LiveGate`.
         */
        router.refresh()
        router.replace('/conversations')
      } catch (cause) {
        setFailure(cause instanceof ApiError ? cause.message : 'Connexion impossible.')
      } finally {
        setPending(null)
      }
    })

  const busy = pending !== null

  /*
   * No autoFocus on the field below. Moving focus on load skips whatever sits above it — here
   * the heading that says which application this is — so a screen reader user lands mid-page
   * with no context. It is the first interactive element anyway, which is one Tab away.
   */
  return (
    <form onSubmit={submit('login')} className="mt-6 space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">
          Pseudo
        </label>
        <Input
          id="nickname"
          autoComplete="username"
          placeholder="Votre pseudo"
          // Both are needed by assistive technology, and they do different jobs: aria-invalid
          // marks the field, aria-describedby points at the text that says why.
          aria-invalid={errors.nickname ? true : undefined}
          aria-describedby={errors.nickname ? 'nickname-error' : undefined}
          {...register('nickname', {
            required: 'Indiquez votre pseudo.',
            maxLength: { value: 32, message: 'Pseudo trop long.' },
          })}
        />
        {errors.nickname ? (
          <p id="nickname-error" className="text-destructive text-sm">
            {errors.nickname.message}
          </p>
        ) : null}
      </div>

      {/*
        The server's refusal is announced rather than only shown. A sighted user sees the message
        appear under the button; without a live region a screen reader user submits the form and
        is told nothing at all. The hint shares the region so the two are read as one answer.
      */}
      {failure ? (
        <div role="alert" className="space-y-1">
          <p className="text-destructive text-sm">{failure}</p>
          {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {/* Submit, so Enter in the field signs in rather than doing nothing. Creating an account
            is the deliberate action and takes a deliberate click. */}
        <Button type="submit" className="w-full" disabled={busy}>
          {pending === 'login' ? <Spinner /> : null}
          {pending === 'login' ? 'Connexion...' : 'Se connecter'}
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => void submit('register')()}
        >
          {pending === 'register' ? <Spinner /> : null}
          {pending === 'register' ? 'Creation...' : 'Creer un compte'}
        </Button>
      </div>
    </form>
  )
}
