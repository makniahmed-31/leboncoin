'use client'

import { useSelectedLayoutSegment } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * The responsive rule, in one place.
 *
 * Both panes are real routes, so the browser back button and the phone's back gesture work
 * without any interception. What changes between breakpoints is only which of the two is on
 * screen: below md the open thread replaces the list, from md up they sit side by side.
 *
 * The hidden pane is display:none rather than moved off-screen, so it leaves the accessibility
 * tree and the tab order entirely — a screen reader on a phone must not be able to tab into a
 * list that is not visible.
 *
 * Which is also why the skip link's target moves with the panes rather than sitting on <main>.
 * Below md with no thread open, <main> is the hidden one, and a skip link pointing into
 * display:none moves focus nowhere at all — the mechanism looks present and does nothing. The
 * rule that holds at every breakpoint is simpler than a media query anyway: with no conversation
 * open the content *is* the list, and the right-hand pane is a placeholder telling you to pick
 * one. tabIndex makes the target actually receive focus rather than merely being scrolled to.
 */
export function ConversationsShell({
  list,
  children,
}: {
  list: React.ReactNode
  children: React.ReactNode
}) {
  const threadOpen = useSelectedLayoutSegment() !== null

  return (
    <div className="bg-muted flex h-dvh w-full">
      <aside
        aria-label="Conversations"
        id={threadOpen ? undefined : 'contenu'}
        tabIndex={threadOpen ? undefined : -1}
        className={cn(
          'border-border bg-muted w-full shrink-0 md:block md:w-90 md:max-w-100 md:min-w-75 md:border-r',
          threadOpen && 'hidden'
        )}
      >
        {list}
      </aside>

      <main
        id={threadOpen ? 'contenu' : undefined}
        tabIndex={threadOpen ? -1 : undefined}
        className={cn(
          'bg-background min-w-0 flex-1 flex-col md:flex',
          threadOpen ? 'flex' : 'hidden'
        )}
      >
        {children}
      </main>
    </div>
  )
}
