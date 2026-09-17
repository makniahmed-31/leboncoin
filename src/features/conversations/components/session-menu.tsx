'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { UserAvatar } from '@/shared/ui/user-avatar'

/**
 * Who is signed in, and how to stop being signed in.
 *
 * A plain button rather than a dropdown, because it has exactly one action. A menu with one item
 * is two interactions where one would do, and a component with a keyboard contract to get right
 * for no benefit.
 */
export function SessionMenu({ nickname, userId }: { nickname: string; userId: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)

  const signOut = async () => {
    setPending(true)

    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      /*
       * The cache is cleared before navigating, not after.
       *
       * Everything in it belongs to the member who is leaving — their conversations, their
       * threads, their unread counts. Left in place, the next person to sign in on this device
       * sees the previous member's inbox rendered from cache for the instant before the first
       * refetch lands. `clear` is blunt and that is the right instinct here.
       */
      queryClient.clear()
      router.refresh()
      router.replace('/login')
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={pending}
      title={`Connecte en tant que ${nickname} - se deconnecter`}
      aria-label={`Connecte en tant que ${nickname}. Se deconnecter.`}
      /*
       * Below 26rem of header the label drops out and this becomes a circular avatar button.
       *
       * 26rem is where a header showing it stops fitting: the longest nickname the cap allows
       * needs 25.4rem before the title starts truncating, and everything else in the row is a
       * fixed size with nothing to give. That threshold is most of the time — the list pane is
       * 360px from md up — but nothing is lost when it trips. The nickname is already the
       * button's accessible name and its tooltip, so what goes is the duplicate, not the only
       * copy, and `px-0.5` leaves the avatar centred in a 36px circle rather than in the
       * lopsided pill that the label's padding would leave behind.
       */
      className="hover:bg-muted flex h-9 shrink-0 items-center gap-1.5 rounded-full px-0.5 transition-colors disabled:opacity-60 @[26rem]/header:pr-2.5"
    >
      <UserAvatar nickname={nickname} userId={userId} className="h-8 w-8 shrink-0 text-xs" />
      <span className="hidden max-w-20 truncate text-[13px] font-medium @[26rem]/header:inline">
        {nickname}
      </span>
    </button>
  )
}
