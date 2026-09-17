'use client'

import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useBumpConversation } from '@/features/conversations/hooks/use-conversations'
import { ApiError } from '@/lib/api-error'
import { useOutboxStore } from '@/stores/outbox-store'

import { sendMessageRequest } from '../api/client'
import type { Message } from '../schemas'
import { sendMessageInputSchema } from '../schemas'

function newClientId() {
  // randomUUID needs a secure context; the fallback keeps the composer working over plain http
  // on a LAN address, which is how the mobile layout usually gets tested.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`
}

type Variables = { clientId: string; body: string }

/**
 * Sending, with the optimistic row living in the outbox store rather than the query cache.
 *
 * The clientId is generated once per message and reused for every retry of that message, so the
 * server can recognise a replay. That is what makes a retry safe after a timeout, where the
 * browser genuinely cannot tell a lost request from a lost response.
 */
export function useSendMessage(conversationId: number, onConfirmed: (message: Message) => void) {
  const enqueue = useOutboxStore((state) => state.enqueue)
  const markSending = useOutboxStore((state) => state.markSending)
  const markQueued = useOutboxStore((state) => state.markQueued)
  const markFailed = useOutboxStore((state) => state.markFailed)
  const remove = useOutboxStore((state) => state.remove)
  const bumpConversation = useBumpConversation()

  /*
   * `mutate` is pulled out rather than the mutation object used directly. React Query hands back
   * a new object on every render, so closing over it would give `send` and `retry` a new identity
   * each time — and the thread puts `retry` in an effect's dependency list, where that means the
   * flush-on-reconnect effect re-runs on every render instead of when the connection changes.
   * `mutate` itself is stable.
   */
  const { mutate } = useMutation({
    mutationFn: ({ clientId, body }: Variables) =>
      sendMessageRequest(conversationId, { clientId, body }),
    onMutate: ({ clientId }) => markSending(clientId),
    onSuccess: (message, { clientId }) => {
      onConfirmed(message)
      bumpConversation(conversationId, message.timestamp, message.body)
      remove(clientId)
    },
    onError: (error, { clientId }) => {
      markFailed(
        clientId,
        error instanceof ApiError ? error.message : "Le message n'a pas pu etre envoye."
      )
    },
  })

  const dispatch = useCallback(
    (clientId: string, body: string) => {
      // An offline send is parked rather than attempted: firing it would burn the retry budget on
      // failures we already know about, and the user would watch it fail for no reason.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        markQueued(clientId)
        return
      }
      mutate({ clientId, body })
    },
    [markQueued, mutate]
  )

  const send = useCallback(
    (rawBody: string) => {
      const parsed = sendMessageInputSchema.safeParse({ body: rawBody, clientId: newClientId() })
      if (!parsed.success) {
        return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Message invalide.' }
      }

      const { body, clientId } = parsed.data
      enqueue({
        clientId,
        conversationId,
        body,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'sending',
      })
      dispatch(clientId, body)

      return { ok: true as const }
    },
    [conversationId, dispatch, enqueue]
  )

  const retry = useCallback(
    (clientId: string, body: string) => dispatch(clientId, body),
    [dispatch]
  )

  const discard = useCallback((clientId: string) => remove(clientId), [remove])

  return { send, retry, discard }
}
