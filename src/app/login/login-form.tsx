'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

import { ApiError } from '@/lib/api-error'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Spinner } from '@/shared/ui/spinner'

type Fields = { nickname: string }

/**
 * The one form in the application, and the one place React Hook Form earns its place.
 *
 * It is worth saying where it is deliberately absent: the message composer is a single textarea
 * whose only rule is a length check already shared with the API, and wrapping that in a form
 * library would add a dependency to the hot path of the product for no validation the schema is
 * not already doing. A form with fields, submission state and per-field errors is a different
 * problem, and this is it.
 */
export function LoginForm() {
  const router = useRouter()
  const [failure, setFailure] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ defaultValues: { nickname: '' } })

  const onSubmit = handleSubmit(async ({ nickname }) => {
    setFailure(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        setFailure(body?.message ?? 'Identifiants invalides.')
        return
      }

      /*
       * `refresh` before `replace`, and both are needed.
       *
       * The session lives in an httpOnly cookie that the server reads during rendering, so the
       * cached Server Component payload for the destination was produced without one. Navigating
       * without refreshing would render the logged-out version of a page the user is now
       * authenticated for.
       */
      router.refresh()
      router.replace('/conversations')
    } catch (cause) {
      setFailure(cause instanceof ApiError ? cause.message : 'Connexion impossible.')
    }
  })

  /*
   * No autoFocus on the field below. Moving focus on load skips whatever sits above it — here
   * the heading that says which application this is — so a screen reader user lands mid-page
   * with no context. It is the first interactive element anyway, which is one Tab away.
   */
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="nickname" className="text-sm font-medium">
          Pseudo
        </label>
        <Input
          id="nickname"
          autoComplete="username"
          // Both are needed by assistive technology, and they do different jobs: aria-invalid
          // marks the field, aria-describedby points at the text that says why.
          aria-invalid={errors.nickname ? true : undefined}
          aria-describedby={errors.nickname ? 'nickname-error' : undefined}
          {...register('nickname', {
            required: 'Indiquez votre pseudo.',
            maxLength: { value: 64, message: 'Pseudo trop long.' },
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
        is told nothing at all.
      */}
      {failure ? (
        <p role="alert" className="text-destructive text-sm">
          {failure}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : null}
        {isSubmitting ? 'Connexion...' : 'Se connecter'}
      </Button>
    </form>
  )
}
