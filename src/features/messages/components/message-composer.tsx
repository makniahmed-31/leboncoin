'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { useComposerStore } from '@/stores/composer-store'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { SendIcon } from '@/shared/ui/icons'
import { cn } from '@/lib/utils'

import { MAX_MESSAGE_LENGTH } from '../schemas'

/** Below this many characters left, the counter appears. Showing it always is just noise. */
const COUNTER_THRESHOLD = 200

/** Matches the max-h-30 on the textarea; past this it scrolls instead of growing. */
const MAX_COMPOSER_HEIGHT = 120

type Props = {
  conversationId: number
  counterpartName: string
  onSend: (body: string) => { ok: true } | { ok: false; error: string }
}

/**
 * No form library here.
 *
 * React Hook Form earns its keep on forms with many fields, cross-field rules and a submit that
 * maps onto a schema. This is one textarea whose validation is a length check shared with the
 * server. Adding a dependency and a resolver for it would be weight without benefit, and the
 * interesting part of sending a message is the optimistic update, not the form state.
 */
export function MessageComposer({ conversationId, counterpartName, onSend }: Props) {
  const draft = useComposerStore((state) => state.drafts[conversationId] ?? '')
  const setDraft = useComposerStore((state) => state.setDraft)
  const clearDraft = useComposerStore((state) => state.clearDraft)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const errorId = useId()
  const hintId = useId()

  const remaining = MAX_MESSAGE_LENGTH - draft.length
  const tooLong = remaining < 0
  const canSend = draft.trim().length > 0 && !tooLong

  // Grow with the content up to a ceiling, then scroll. Driven by the draft rather than by the
  // input event so that a draft restored from storage sizes the box correctly on mount too.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    if (draft.length > 0) {
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_COMPOSER_HEIGHT)}px`
    }
  }, [draft])

  const submit = () => {
    if (!canSend) return

    const result = onSend(draft)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setError(null)
    clearDraft(conversationId)
    // Focus stays in the composer: the user is very likely to send another one, and taking focus
    // back to the top of the page after each message makes a keyboard conversation unusable.
    textareaRef.current?.focus()
  }

  return (
    <div className="border-border shrink-0 border-t px-3 py-3.5 sm:px-4.5">
      <div
        className={cn(
          'bg-background flex items-end gap-2 rounded-[26px] border py-2 pr-2 pl-4',
          error || tooLong ? 'border-destructive' : 'border-border'
        )}
      >
        <label htmlFor={`composer-${conversationId}`} className="sr-only">
          Message a {counterpartName}
        </label>
        <Textarea
          id={`composer-${conversationId}`}
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder="Ecrivez votre message"
          aria-describedby={cn(hintId, error ? errorId : undefined)}
          aria-invalid={error || tooLong ? true : undefined}
          onChange={(event) => {
            setDraft(conversationId, event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line. The IME check stops a Japanese or Korean
            // composition from being sent halfway through by the Enter that confirms a candidate.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
          // shadcn's Textarea draws its own bordered box; here the border belongs to the pill
          // this sits inside, so the box is unset rather than reproduced.
          className="max-h-30 min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1.5 text-[15px] shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
        />

        <Button
          type="button"
          size="icon"
          onClick={submit}
          disabled={!canSend}
          aria-label="Envoyer le message"
          className="h-[38px] w-[38px] shrink-0"
        >
          <SendIcon className="h-[17px] w-[17px]" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 px-3.5 pt-1.5">
        <p id={hintId} className="text-muted-foreground text-xs">
          Entree pour envoyer, Maj + Entree pour aller a la ligne.
        </p>
        {remaining <= COUNTER_THRESHOLD ? (
          <p
            // Polite rather than assertive: it updates on every keystroke near the limit, and
            // assertive would interrupt the user mid-word on every one of them.
            aria-live="polite"
            className={cn(
              'text-xs tabular-nums',
              tooLong ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {remaining} caracteres restants
          </p>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-destructive px-3 pt-1 text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}
