'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SoundState = {
  enabled: boolean
  toggle: () => void
}

/**
 * Whether arriving messages make a sound, remembered across reloads.
 *
 * Like the drafts store, this is state React Query has no business holding: the server does not
 * own it, nobody else can change it, and a refetch must not reset it. It is per device rather
 * than per account on purpose — "not on this laptop, in this open-plan office" is the preference
 * people actually have, and it would be wrong to carry it to their phone.
 *
 * Deliberately not cleared on sign-out, unlike the drafts. A draft is someone's unsent words and
 * belongs to them; "no sound on this machine" is a property of the machine, and the next person
 * to sign in on a shared device is better served by inheriting the quiet than by being surprised.
 */
export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      // On by default: a notification feature that has to be discovered and enabled to exist is
      // one most people never learn they have. It is one click to silence, and the tone is
      // deliberately quiet.
      enabled: true,
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: 'lbc-messaging-sound',
      /*
       * Hydrated explicitly, after mount, rather than while the store is being created.
       *
       * Synchronous hydration reads localStorage during module evaluation, so the first client
       * render already has the stored value while the server rendered the default — which is a
       * hydration mismatch for any control that shows the preference. Deferring it means both
       * renders agree on the default and the stored value is applied a tick later, which is a
       * silent no-op for the overwhelmingly common case where it *is* the default.
       */
      skipHydration: true,
    }
  )
)
