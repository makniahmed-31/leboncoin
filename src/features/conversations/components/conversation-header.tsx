'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

import { UserAvatar } from '@/shared/ui/user-avatar'
import { BackIcon } from '@/shared/ui/icons'
import { formatAbsolute, formatListStamp } from '@/shared/utils/date'

import { useConversation } from '../hooks/use-conversation'
import { counterpartOf, type Conversation } from '../schemas'
import { ProductBadge } from './product-badge'

export function ConversationHeader({
  conversation,
  currentUserId,
}: {
  conversation: Conversation
  currentUserId: number
}) {
  // Seeded by the page through the dehydrated cache, so this renders immediately and then keeps
  // itself current as polling refreshes the conversation.
  const { data = conversation } = useConversation(conversation.id)
  const counterpart = counterpartOf(data, currentUserId)
  const headerRef = useRef<HTMLElement>(null)

  /**
   * Moves focus into the thread when one is opened.
   *
   * Without this, a keyboard user who picks a conversation is left with focus back in the list
   * and has to tab past every remaining conversation to reach the composer — fifty-odd stops on
   * the seeded data. Focusing the header instead puts them one tab from the message they came to
   * write, and a screen reader announces whose conversation they just opened.
   */
  const focusedFor = useRef<number | null>(null)
  useEffect(() => {
    if (focusedFor.current === conversation.id) return
    focusedFor.current = conversation.id
    headerRef.current?.focus()
  }, [conversation.id])

  return (
    <header
      ref={headerRef}
      tabIndex={-1}
      aria-label={`Conversation avec ${counterpart.nickname}`}
      className="border-border flex shrink-0 items-center gap-3 border-b px-3 py-3 outline-none sm:px-4.5"
    >
      {/* A real link, not history.back(): it has to work when the thread is opened directly from
          a shared URL, where there is no previous page to go back to. Hidden on desktop, where
          the list is already on screen next to it. */}
      <Link
        href="/conversations"
        aria-label="Retour a la liste des conversations"
        className="text-muted-foreground hover:bg-muted -ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full md:hidden"
      >
        <BackIcon className="h-5 w-5" />
      </Link>

      <UserAvatar
        nickname={counterpart.nickname}
        userId={counterpart.id}
        className="h-10 w-10 text-[15px]"
      />

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">{counterpart.nickname}</h2>

        {/* The listing sits directly under the name because it is the subject of the thread:
            on a marketplace "who" without "about what" is half the context, and someone with
            several threads with the same seller has nothing else to tell them apart. */}
        {data.product ? <ProductBadge product={data.product} size="md" className="mt-1" /> : null}
        {/*
          The design puts a presence line here — "Actif il y a 10 min". There is no presence in
          this API and nothing that could stand in for one: the only timestamp available is when
          the last message was sent, which is a different fact. Relabelling it would have the
          interface assert that somebody was online when all it knows is that they wrote
          something, so the wording stays what the data actually supports.
        */}
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          Dernier message{' '}
          <time
            dateTime={new Date(data.lastMessageTimestamp * 1000).toISOString()}
            title={formatAbsolute(data.lastMessageTimestamp)}
          >
            {formatListStamp(data.lastMessageTimestamp)}
          </time>
        </p>
      </div>
    </header>
  )
}
