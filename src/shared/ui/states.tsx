import type { ReactNode } from 'react'

import { Button } from './button'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {action}
    </div>
  )
}

/**
 * The failure surface. It always offers a way forward, and `role="alert"` means a screen reader
 * hears it when it replaces a list that was loading a moment ago.
 */
export function ErrorState({
  title = 'Chargement impossible',
  description,
  onRetry,
  retrying = false,
}: {
  title?: string
  description: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <p className="text-base font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {onRetry ? (
        <Button type="button" onClick={onRetry} disabled={retrying} size="sm">
          {retrying ? 'Nouvelle tentative...' : 'Reessayer'}
        </Button>
      ) : null}
    </div>
  )
}
