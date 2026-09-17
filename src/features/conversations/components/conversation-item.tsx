'use client'

import Link from 'next/link'
import { memo } from 'react'

import { cn } from '@/lib/utils'
import { UserAvatar } from '@/shared/ui/user-avatar'
import { formatAbsolute, formatListStamp } from '@/shared/utils/date'

import { counterpartOf, type Conversation } from '../schemas'
import { ProductBadge } from './product-badge'

type Props = {
  conversation: Conversation
  currentUserId: number
  active: boolean
  onPrefetch: (conversationId: number) => void
}

/** Above this the badge reads "99+"; the API stops counting there too. */
const UNREAD_CAP = 99

function ConversationItemComponent({ conversation, currentUserId, active, onPrefetch }: Props) {
  const counterpart = counterpartOf(conversation, currentUserId)
  const unread = conversation.unreadCount > 0

  return (
    <li>
      <Link
        href={`/conversations/${conversation.id}`}
        aria-current={active ? 'page' : undefined}
        // Warming the thread on intent rather than on click: by the time the tap lands the
        // messages are usually already in the cache, so the pane renders without a skeleton.
        onMouseEnter={() => onPrefetch(conversation.id)}
        onFocus={() => onPrefetch(conversation.id)}
        onTouchStart={() => onPrefetch(conversation.id)}
        className={cn(
          'flex items-center gap-3 rounded-[18px] px-3.5 py-2.5 transition-colors',
          'hover:bg-muted',
          active ? 'bg-primary/10 hover:bg-primary/10' : 'bg-card shadow-sm'
        )}
      >
        <UserAvatar nickname={counterpart.nickname} userId={counterpart.id} />

        <span className="min-w-0 flex-1">
          {/* Name and stamp share a baseline row. The name is the flexible one and the stamp
              never shrinks, so a long nickname loses characters to the ellipsis rather than
              pushing the time off the edge of the row. */}
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn('truncate', unread ? 'font-bold' : 'font-semibold')}>
              {counterpart.nickname}
            </span>
            <time
              dateTime={new Date(conversation.lastMessageTimestamp * 1000).toISOString()}
              title={formatAbsolute(conversation.lastMessageTimestamp)}
              className={cn(
                'shrink-0 text-xs',
                unread ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}
            >
              {formatListStamp(conversation.lastMessageTimestamp)}
            </time>
          </span>

          <span className="mt-0.5 flex items-center gap-2">
            {conversation.preview ? (
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px]',
                  unread ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {/* "Vous : " so the list distinguishes a reply the member is waiting on from
                    their own last word, which is the difference between a thread that needs
                    attention and one that does not. */}
                {conversation.lastMessageAuthorId === currentUserId ? (
                  <span className="text-muted-foreground">Vous&nbsp;: </span>
                ) : null}
                {conversation.preview}
              </span>
            ) : (
              // Absent rather than blank: an empty line would still reserve its height and leave
              // a row that looks broken instead of one that is simply shorter.
              <span className="min-w-0 flex-1" />
            )}

            {unread ? (
              <span
                // The count is in the text, so the badge needs no label of its own — but the
                // number alone reads as "seven" with no context, hence the visually hidden noun.
                className="bg-primary text-primary-foreground inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
              >
                {conversation.unreadCount > UNREAD_CAP
                  ? `${UNREAD_CAP}+`
                  : conversation.unreadCount}
                <span className="sr-only"> messages non lus</span>
              </span>
            ) : null}
          </span>

          {conversation.product ? (
            <ProductBadge product={conversation.product} className="mt-1.5" />
          ) : null}
        </span>
      </Link>
    </li>
  )
}

/**
 * Memoised because the list re-renders on every live event and on every draft keystroke elsewhere
 * in the tree. The props are a stable object from the cache plus two primitives, so the identity
 * check actually holds; without it the profiler showed the whole list reconciling on every tick
 * for no visible change.
 */
export const ConversationItem = memo(ConversationItemComponent)
