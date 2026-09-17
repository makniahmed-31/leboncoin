'use client'

import { Button } from '@/shared/ui/button'

/**
 * Scoped to the conversations segment so a failure inside one thread does not blank the whole
 * application. The shell, the list and the navigation stay on screen and only this pane resets.
 */
export default function ConversationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <h2 className="text-lg font-semibold">Conversation indisponible</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Impossible de charger cette discussion pour le moment.
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
