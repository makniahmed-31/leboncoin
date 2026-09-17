'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { usePrefetchThread } from '@/features/messages/hooks/use-prefetch-thread'
import { queryKeys } from '@/lib/query-keys'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { useLiveEvent } from '@/shared/live/live-provider'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { PlusIcon, SearchIcon } from '@/shared/ui/icons'
import { CONVERSATION_SKELETON_COUNT, ConversationRowSkeleton } from '@/shared/ui/skeletons'
import { Spinner } from '@/shared/ui/spinner'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
import { EmptyState, ErrorState } from '@/shared/ui/states'

import { useConversations } from '../hooks/use-conversations'
import { ConversationItem } from './conversation-item'
import { NewConversationDialog } from './new-conversation-dialog'
import { SessionMenu } from './session-menu'

export function ConversationList({
  currentUserId,
  nickname,
}: {
  currentUserId: number
  nickname: string
}) {
  const params = useParams<{ conversationId?: string }>()
  const activeId = params.conversationId ? Number(params.conversationId) : null
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // The input stays fully responsive while the query trails behind it; typing is never gated on
  // a network round trip.
  const debouncedSearch = useDebouncedValue(search.trim())

  const {
    conversations,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations(debouncedSearch || undefined)

  // The list is cheap to refresh and changes rarely, so a live event just invalidates it. The
  // thread does something more careful, because refetching it means refetching every loaded page.
  useLiveEvent('conversations:changed', () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.root })
  })

  const prefetchThread = usePrefetchThread()

  // The other side of every loaded conversation, so the picker can mark the people the member is
  // already talking to rather than silently redirecting them into an existing thread.
  const counterpartIds = useMemo(
    () =>
      conversations.map((conversation) =>
        conversation.senderId === currentUserId ? conversation.recipientId : conversation.senderId
      ),
    [conversations, currentUserId]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void fetchNextPage()
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage])

  const searching = debouncedSearch.length > 0

  return (
    <div className="flex h-full flex-col">
      {/*
        A container query, not a breakpoint. This pane is full-width below md and a fixed 360px
        from md up, so the header is at its narrowest on a *wide* viewport — the one case a `md:`
        prefix gets backwards. `@container/header` lets the row respond to the width it actually
        has, and the named container is what SessionMenu keys its label off.
      */}
      <div className="@container/header flex items-center justify-between gap-2 px-4.5 pt-5 pb-3">
        {/* min-w-0 so the title yields before the row can overflow: the controls all have a fixed
            size and nothing useful to give up, so the truncation belongs on the one element whose
            meaning survives it. */}
        <h1 className="min-w-0 truncate text-[21px] font-bold tracking-tight">Messages</h1>

        {/* The tighter gap is what keeps the title off the ellipsis on a 320px phone, which is
            the narrowest this pane ever gets. */}
        <div className="flex shrink-0 items-center gap-1 @[22rem]/header:gap-1.5">
          {/* The list header is the one piece of chrome on screen at every breakpoint and on
              every route under /conversations, which makes it the only place these controls can
              live without being duplicated into the thread header. */}
          <ThemeToggle />
          <SessionMenu nickname={nickname} userId={currentUserId} />

          <NewConversationDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            existingCounterpartIds={counterpartIds}
            trigger={
              /* Icon only, so the header stays the same height as the row beneath it. The label
                 moves to aria-label rather than disappearing: the button still has an accessible
                 name, and the title attribute gives sighted users the same words on hover. */
              <Button
                type="button"
                size="icon"
                aria-label="Nouvelle conversation"
                title="Nouvelle conversation"
                className="h-9 w-9"
              >
                <PlusIcon className="h-[18px] w-[18px]" />
              </Button>
            }
          />
        </div>
      </div>

      <div className="px-4.5 pb-3">
        {/*
          `type="search"` rather than `type="text"`: it gives mobile keyboards a search key and
          desktop browsers a clear control, both of which are behaviour users already expect from
          a field that looks like this and would otherwise have to be rebuilt by hand.

          The label is visually hidden rather than omitted. A placeholder is not a label — it
          disappears the moment anything is typed, and it is not reliably announced.
        */}
        <label htmlFor="conversation-search" className="sr-only">
          Rechercher une conversation
        </label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="conversation-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un membre, une annonce"
            className="bg-card h-10 rounded-full pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {isPending ? (
          <ul className="space-y-1.5" aria-hidden="true">
            {Array.from({ length: CONVERSATION_SKELETON_COUNT }, (_, index) => (
              <ConversationRowSkeleton key={index} index={index} />
            ))}
          </ul>
        ) : isError ? (
          <ErrorState
            description={error.message}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : conversations.length === 0 ? (
          /* Two empty states, because they mean different things and only one of them is a dead
             end. "No results" needs a way back to the full list; "no conversations at all" needs
             a way to start one. */
          searching ? (
            <EmptyState
              title="Aucun resultat"
              description={`Aucune conversation ne correspond a "${debouncedSearch}".`}
              action={
                <Button type="button" variant="secondary" onClick={() => setSearch('')}>
                  Effacer la recherche
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Aucune conversation"
              description="Demarrez une discussion avec un autre membre pour la voir apparaitre ici."
              action={
                <Button type="button" onClick={() => setDialogOpen(true)}>
                  Nouvelle conversation
                </Button>
              }
            />
          )
        ) : (
          <>
            {/*
              Result counts are announced politely rather than the list silently changing under
              the cursor. A sighted user sees rows change as they type; without this a screen
              reader user gets no feedback that anything happened at all.
            */}
            <p aria-live="polite" className="sr-only">
              {searching
                ? `${conversations.length} conversation${conversations.length > 1 ? 's' : ''} trouvee${conversations.length > 1 ? 's' : ''}`
                : ''}
            </p>

            <ul className="space-y-1.5" aria-label="Liste des conversations">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  currentUserId={currentUserId}
                  active={conversation.id === activeId}
                  onPrefetch={prefetchThread}
                />
              ))}
            </ul>

            {/* Sentinel rather than a button: the next page loads before the user reaches the
                bottom, and the button below stays as the keyboard path. */}
            <div ref={sentinelRef} className="h-px" />

            {hasNextPage ? (
              <div className="flex justify-center py-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Spinner /> : null}
                  {isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
