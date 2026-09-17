'use client'

import { useEffect, useRef } from 'react'

import { useLiveEvent } from '@/shared/live/live-provider'
import { useSoundStore } from '@/stores/sound-store'

import { playNotificationSound, primeNotificationSound } from '../audio'

/**
 * A burst of messages is one sound. Backfill after a reconnect is the case this exists for:
 * without it, a stream that reopens and delivers nine queued events plays nine overlapping blips.
 */
const MIN_INTERVAL_MS = 1_500

/**
 * Plays a sound when a message arrives from somebody else.
 *
 * Mounted once, at the conversations shell, rather than per thread — the point of a notification
 * is the message in the conversation the member is *not* looking at, so a hook that lived in the
 * open thread would only ever announce the messages already on screen.
 *
 * Own messages are excluded by author, not by guessing from the open thread. The API publishes
 * `message.created` to every participant including the sender, so without the check a member
 * would hear their own message echo back a moment after sending it.
 */
export function useNotificationSound(currentUserId: number) {
  const enabled = useSoundStore((state) => state.enabled)
  const lastPlayedAt = useRef(0)

  useEffect(() => {
    // Unlock the audio context on the first interaction, whatever it is. Cheap, idempotent, and
    // it has to happen well before the first message rather than in response to one.
    primeNotificationSound()

    /*
     * Applies the stored preference, which the store deliberately did not read at creation time.
     * Done here because this hook is mounted exactly once, in the shell that wraps every
     * authenticated route — the same reason it is the right place to own the sound at all.
     */
    void useSoundStore.persist.rehydrate()
  }, [])

  useLiveEvent('message:received', (event) => {
    if (!enabled) return
    if (event.authorId === currentUserId) return

    const now = Date.now()
    if (now - lastPlayedAt.current < MIN_INTERVAL_MS) return
    lastPlayedAt.current = now

    playNotificationSound()
  })
}
