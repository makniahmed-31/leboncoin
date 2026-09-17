'use client'

import { useEffect } from 'react'

import { Button } from '@/shared/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Where Sentry would be wired in. The digest is what ties this screen to the server log line.
    console.error('Unhandled application error', error)
  }, [error])

  return (
    <div
      role="alert"
      className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <h1 className="text-xl font-bold">Une erreur est survenue</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        La messagerie n&rsquo;a pas pu s&rsquo;afficher. Le probleme vient de notre cote, vous
        pouvez reessayer.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">Reference technique : {error.digest}</p>
      ) : null}
      <Button type="button" onClick={reset}>
        Reessayer
      </Button>
    </div>
  )
}
