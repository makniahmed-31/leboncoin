'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useMarkConversationRead } from '@/features/conversations/hooks/use-conversations'
import { useTypingIndicator } from '@/features/typing/hooks/use-typing-indicator'
import { useLiveEvent, useWatchConversation } from '@/shared/live/live-provider'
import { Button } from '@/shared/ui/button'
import { TypingIndicator } from '@/shared/ui/typing-indicator'
import { MessageThreadSkeleton } from '@/shared/ui/skeletons'
import { Spinner } from '@/shared/ui/spinner'
import { EmptyState, ErrorState } from '@/shared/ui/states'
import { useOutboxStore } from '@/stores/outbox-store'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'
import { formatDayLabel } from '@/shared/utils/date'

import { useMessages } from '../hooks/use-messages'
import { useSendMessage } from '../hooks/use-send-message'
import type { MessageStatus } from '../schemas'
import { DayDivider, MessageBubble } from './message-bubble'
import { MessageComposer } from './message-composer'

type Row =
  | { kind: 'divider'; key: string; label: string }
  | {
      kind: 'message'
      key: string
      clientId?: string
      body: string
      timestamp: number
      mine: boolean
      status: MessageStatus
      error?: string
    }

/** Treat the user as "at the bottom" within this many pixels, so a stray pixel does not count. */
const BOTTOM_THRESHOLD = 120

type Props = {
  conversationId: number
  currentUserId: number
  counterpart: { id: number; nickname: string }
}

export function MessageThread({ conversationId, currentUserId, counterpart }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)
  const previousHeight = useRef(0)
  const lastScrollTop = useRef(0)
  const [announcement, setAnnouncement] = useState('')
  const online = useOnlineStatus()
  const counterpartTyping = useTypingIndicator(conversationId)

  const {
    messages,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    insert,
    refreshLatest,
  } = useMessages(conversationId)

  const outbox = useOutboxStore((state) => state.entries)
  const { send, retry, discard } = useSendMessage(conversationId, insert)

  useWatchConversation(conversationId)

  /*
   * Opening a thread is reading it, so the watermark moves once per conversation.
   *
   * Keyed on the id rather than run on every render: without the ref this fires again on each
   * incoming message, which is a write per message received on a thread the user is sitting in.
   * It is deliberately not tied to scrolling to the bottom — a member who opens a thread and
   * reads the newest message at the top of the viewport has read it, and a badge that lingers
   * until they scroll reads as broken rather than as precise.
   */
  const markRead = useMarkConversationRead()
  const markedFor = useRef<number | null>(null)
  useEffect(() => {
    if (markedFor.current === conversationId) return
    markedFor.current = conversationId
    markRead.mutate(conversationId)
    // `markRead` is a fresh mutation object on every render; depending on it would defeat the
    // guard above rather than reinforce it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useLiveEvent('messages:changed', (event) => {
    if (event.conversationId === conversationId) void refreshLatest()
  })

  const pending = useMemo(
    () => outbox.filter((entry) => entry.conversationId === conversationId),
    [conversationId, outbox]
  )

  // Anything parked while the connection was down goes out as soon as it is back. The status
  // change to 'sending' is what stops this from looping.
  useEffect(() => {
    if (!online) return
    for (const entry of pending) {
      if (entry.status === 'queued') retry(entry.clientId, entry.body)
    }
  }, [online, pending, retry])

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = []
    let lastDay = ''

    const pushWithDivider = (timestamp: number, row: Row) => {
      const day = formatDayLabel(timestamp)
      if (day !== lastDay) {
        lastDay = day
        result.push({ kind: 'divider', key: `divider-${day}-${timestamp}`, label: day })
      }
      result.push(row)
    }

    for (const message of messages) {
      pushWithDivider(message.timestamp, {
        kind: 'message',
        key: `m-${message.id}`,
        body: message.body,
        timestamp: message.timestamp,
        mine: message.authorId === currentUserId,
        status: 'sent',
      })
    }

    for (const entry of pending) {
      pushWithDivider(entry.timestamp, {
        kind: 'message',
        key: `o-${entry.clientId}`,
        clientId: entry.clientId,
        body: entry.body,
        timestamp: entry.timestamp,
        mine: true,
        status: entry.status === 'queued' ? 'sending' : entry.status,
        error: entry.status === 'queued' ? undefined : entry.error,
      })
    }

    return result
  }, [currentUserId, messages, pending])

  // React Compiler will not memoize this component, because useVirtualizer returns functions it
  // cannot prove are stable. That is the right call and it costs nothing here: the virtualizer is
  // itself the optimisation, and each row it renders is memoized on its own.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // A first guess only; every row reports its real height through measureElement, which is what
    // keeps a wrapped four-line message from shifting everything below it.
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  })

  const rowCount = rows.length

  /**
   * Scrolling goes through the virtualizer, never through `scrollTop` directly.
   *
   * The virtualizer keeps its own record of the offset and re-applies it to the element when it
   * attaches and while rows are measured. A raw `scrollTop` write is invisible to that record, so
   * it survives a frame and is then reverted to whatever the virtualizer last knew — zero, on a
   * thread that has just opened. Going through `scrollToIndex` tells the virtualizer where the
   * view is meant to be, so there is nothing left to revert.
   *
   * In practice this surfaced under `next dev`: StrictMode mounts effects twice, the second mount
   * re-attaches the virtualizer to a container that is already scrolled, and the reader landed at
   * the top of the conversation instead of at its newest message — on some threads and not
   * others, depending on whether a measurement pass fell after the write. A production build did
   * not reproduce it. It is fixed rather than dismissed because a raw write was the wrong channel
   * either way, and because "only in the dev server" is where the whole team reads the thread.
   */
  const scrollToBottom = useCallback(() => {
    if (rowCount > 0) virtualizer.scrollToIndex(rowCount - 1, { align: 'end' })
  }, [rowCount, virtualizer])

  /**
   * The measured height of the whole thread, and a dependency of the effects below.
   *
   * The virtualizer reports `estimateSize` for every row it has not drawn yet and the real height
   * only once that row has mounted and been measured, so the scrollable area is a guess on the
   * first pass after a thread opens. Anchoring to the bottom of a guess is not anchoring to the
   * bottom. Depending on the total size re-runs the corrections on every measurement pass, so the
   * view converges on the real end of the thread rather than a predicted one.
   */
  const totalSize = virtualizer.getTotalSize()

  /**
   * Opens the thread on its newest message, once per conversation.
   *
   * Without it the view starts at the top of whatever page zero happened to hold, which on a long
   * conversation is the middle of a discussion. The guard is a ref rather than a trimmed
   * dependency array: this has to re-run when the first rows arrive, but must never fire again
   * afterwards, or a user who has scrolled up to read history gets yanked back down every time a
   * message lands.
   */
  const openedAt = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (isPending || rowCount === 0 || openedAt.current === conversationId) return
    openedAt.current = conversationId
    // Pinning is what makes the effect below keep re-anchoring as rows report their real heights.
    pinnedToBottom.current = true
    // Reset rather than carry over: both of these describe the thread that was on screen a moment
    // ago, and a different conversation is neither "growth" of it nor a scroll within it.
    previousHeight.current = 0
    lastScrollTop.current = 0
    scrollToBottom()
  }, [conversationId, isPending, rowCount, scrollToBottom])

  /**
   * Keeps the viewport where it belongs whenever the scrollable area grows.
   *
   * Three things grow it, and each wants something different. A reader pinned to the newest
   * message wants to stay there, so the view follows the bottom. A reader who has scrolled up to
   * load history wants the message under their eyes to stay under their eyes, so the height that
   * was just inserted above them is added back to scrollTop. A reader in the middle of the thread
   * wants nothing to move at all.
   *
   * It runs on measurement as well as on new rows, which is what makes opening a thread land on
   * the bottom rather than near it. Before paint, so no correction is ever visible.
   */
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const height = element.scrollHeight
    const growth = height - previousHeight.current
    previousHeight.current = height

    if (pinnedToBottom.current) {
      // Re-asserted on every pass, not only when the thread grew. The anchor can be lost with no
      // growth at all — switching conversations re-uses the same scroll container, and the
      // virtualizer re-applies its own recorded offset to it while rows are measured — and tying
      // the correction to growth meant nothing ever put it back. Cheap to make unconditional: it
      // is a no-op whenever the view is already where it should be.
      if (height - element.scrollTop - element.clientHeight > 1) scrollToBottom()
      return
    }

    // Only prepended history moves a reader who is not anchored, and only the height that was
    // inserted above them needs giving back.
    if (growth > 0 && (isFetchingNextPage || element.scrollTop < BOTTOM_THRESHOLD)) {
      virtualizer.scrollToOffset(element.scrollTop + growth)
    }
  }, [totalSize, rowCount, isFetchingNextPage, scrollToBottom, virtualizer])

  // Announce what arrives from the other person. Own messages are excluded: the user knows what
  // they just sent, and repeating it back makes the thread unusable with a screen reader.
  useEffect(() => {
    const last = messages.at(-1)
    if (!last || last.authorId === currentUserId) return
    setAnnouncement(`${counterpart.nickname} : ${last.body}`)
  }, [counterpart.nickname, currentUserId, messages])

  /**
   * Direction, not distance, is what detaches the view from the newest message.
   *
   * Reading the distance alone looks right and is subtly wrong, because the corrections above set
   * scrollTop themselves and the browser delivers the event for that a frame later — by which time
   * a measurement pass may have grown the thread underneath it. That stale event reports a reader
   * far from the bottom, unpins the view, and the next correction then politely declines to move
   * it. Which reader it stranded came down to whether measurement won the race, so a thread of
   * short messages opened at the bottom and a thread of long ones opened a screenful above it.
   *
   * Only an upward scroll is something the reader actually did: growth never moves scrollTop, and
   * every correction here only ever increases it.
   */
  const onScroll = () => {
    const element = scrollRef.current
    if (!element) return

    const top = element.scrollTop
    const scrolledUp = top < lastScrollTop.current - 1
    lastScrollTop.current = top

    if (scrolledUp) {
      pinnedToBottom.current = false
    } else if (element.scrollHeight - top - element.clientHeight < BOTTOM_THRESHOLD) {
      pinnedToBottom.current = true
    }

    if (top < 300 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }

  if (isError) {
    return (
      <ErrorState
        title="Conversation indisponible"
        description={error.message}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6"
      >
        {isPending ? (
          <MessageThreadSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucun message"
            description={`Ecrivez le premier message a ${counterpart.nickname}.`}
          />
        ) : (
          <>
            {isFetchingNextPage ? (
              <div className="text-muted-foreground flex justify-center pb-3">
                <Spinner />
              </div>
            ) : null}

            {hasNextPage && !isFetchingNextPage ? (
              <div className="flex justify-center pb-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void fetchNextPage()}
                >
                  Charger les messages precedents
                </Button>
              </div>
            ) : null}

            {/* The virtualizer owns the height of this element; the rows are absolutely
                positioned inside it. Only what fits on screen exists in the DOM. */}
            <ol
              className="relative w-full list-none"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
              aria-label={`Messages avec ${counterpart.nickname}`}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null

                return (
                  <li
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className="absolute top-0 left-0 w-full pb-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {row.kind === 'divider' ? (
                      <DayDivider label={row.label} />
                    ) : (
                      <MessageBubble
                        body={row.body}
                        timestamp={row.timestamp}
                        mine={row.mine}
                        authorName={counterpart.nickname}
                        status={row.status}
                        error={row.error}
                        onRetry={
                          row.clientId && row.status === 'failed'
                            ? () => retry(row.clientId!, row.body)
                            : undefined
                        }
                        onDiscard={
                          row.clientId && row.status === 'failed'
                            ? () => discard(row.clientId!)
                            : undefined
                        }
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>

      {/*
        Below the scroll area rather than as a row inside it, and that is deliberate.
        
        A virtualized list measures and positions every row it owns; an item that appears and
        disappears every few seconds would resize the scroll area under the reader and fight the
        anchoring logic above for control of the offset. Pinned here it occupies its own strip,
        the thread above it never moves, and it is always visible — including to a reader who has
        scrolled up into history, which is where a row inside the list would have been off screen.
      */}
      {counterpartTyping ? (
        <div className="shrink-0 px-3 sm:px-6">
          <TypingIndicator nickname={counterpart.nickname} />
        </div>
      ) : null}

      {/* Outside the virtualized area on purpose: a live region that gets unmounted and remounted
          as the user scrolls would announce old messages again. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      <MessageComposer
        conversationId={conversationId}
        counterpartName={counterpart.nickname}
        onSend={(body) => {
          pinnedToBottom.current = true
          return send(body)
        }}
      />
    </div>
  )
}
