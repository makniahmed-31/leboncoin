'use client'

import { memo } from 'react'

import { RetryIcon } from '@/shared/ui/icons'
import { Spinner } from '@/shared/ui/spinner'
import { cn } from '@/lib/utils'
import { formatAbsolute, formatTime } from '@/shared/utils/date'

import type { MessageStatus } from '../schemas'

export type BubbleProps = {
  body: string
  timestamp: number
  mine: boolean
  authorName: string
  status: MessageStatus
  error?: string
  onRetry?: () => void
  onDiscard?: () => void
}

function MessageBubbleComponent({
  body,
  timestamp,
  mine,
  authorName,
  status,
  error,
  onRetry,
  onDiscard,
}: BubbleProps) {
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {/*
        The name used to be printed above every incoming bubble. In a thread with exactly two
        people it repeats what the header already says, on every single message, so the design
        drops it — but dropping it outright would leave a screen reader with a run of bubbles and
        no way to tell who sent which. It becomes attribution that is read and not drawn.

        It sits outside the bubble rather than inside it so the bubble's text is still only the
        message, which is what the copy-to-clipboard behaviour of a selection depends on.
      */}
      <span className="sr-only">{mine ? 'Vous' : authorName} :</span>

      <div
        className={cn(
          'rounded-bubble max-w-[min(30rem,78%)] px-[15px] py-2.5 text-[15px] leading-[1.45]',
          // `break-words` matters: a pasted URL with no spaces otherwise stretches the bubble
          // past the viewport and the whole thread scrolls sideways.
          'break-words whitespace-pre-wrap',
          // Only the token, with no generic text colour after it: `cn` is tailwind-merge, so a
          // trailing `text-white` or `text-foreground` wins the conflict and strips the token
          // out of the class list entirely. The two happen to resolve to the same colour today,
          // which is exactly why it would have gone unnoticed until somebody retuned a bubble and
          // found the variable had no effect.
          mine
            ? 'bg-bubble-me text-bubble-me-foreground'
            : 'bg-bubble-them text-bubble-them-foreground',
          status === 'failed' && 'ring-destructive opacity-70 ring-1',
          status === 'sending' && 'opacity-85'
        )}
      >
        {/* Rendered as a text child, never as HTML. React escapes it, which is the whole XSS
            defence for user-authored content and the reason no sanitiser is needed here. */}
        {body}
      </div>

      <span className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
        {status === 'sending' ? (
          <>
            <Spinner className="h-3 w-3" />
            Envoi...
          </>
        ) : status === 'failed' ? (
          <>
            {/* Not colour alone: the state is spelled out, so it survives a greyscale screen and
                a colour-blind reader. */}
            <span className="text-destructive font-medium">{error ?? 'Echec de l envoi'}</span>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="text-primary inline-flex items-center gap-1 font-medium underline"
              >
                <RetryIcon className="h-3.5 w-3.5" />
                Reessayer
              </button>
            ) : null}
            {onDiscard ? (
              <button type="button" onClick={onDiscard} className="underline">
                Supprimer
              </button>
            ) : null}
          </>
        ) : (
          <time
            dateTime={new Date(timestamp * 1000).toISOString()}
            title={formatAbsolute(timestamp)}
          >
            {formatTime(timestamp)}
          </time>
        )}
      </span>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleComponent)

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center pt-0.5 pb-1.5">
      <span className="bg-muted text-muted-foreground rounded-full px-3 py-[5px] text-xs font-medium">
        {label}
      </span>
    </div>
  )
}
