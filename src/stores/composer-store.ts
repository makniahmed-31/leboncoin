'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ComposerState = {
  drafts: Record<number, string>
  setDraft: (conversationId: number, value: string) => void
  clearDraft: (conversationId: number) => void
  clearAll: () => void
}

/**
 * Drafts are per conversation and survive a reload.
 *
 * This is the kind of state that does not belong in React Query: it is not owned by the server,
 * nobody else can change it, and it must not be refetched away. It does not belong in the URL
 * either, which is why the store exists at all.
 *
 * Surviving a reload means surviving a sign-out too unless something says otherwise, which is
 * what `clearAll` is for. A draft is unsent text the member wrote, keyed by conversation id — and
 * two members who share a device also share every conversation they are both in, so leaving it
 * behind shows one person's half-written message to the other. The logout path clears it for the
 * same reason it clears the query cache.
 */
export const useComposerStore = create<ComposerState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (conversationId, value) =>
        set((state) => ({ drafts: { ...state.drafts, [conversationId]: value } })),
      clearDraft: (conversationId) =>
        set((state) => {
          const drafts = { ...state.drafts }
          delete drafts[conversationId]
          return { drafts }
        }),
      clearAll: () => set({ drafts: {} }),
    }),
    { name: 'lbc-messaging-drafts' }
  )
)
