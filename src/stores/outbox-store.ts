'use client'

import { create } from 'zustand'

export type OutboxStatus = 'sending' | 'queued' | 'failed'

export type OutboxEntry = {
  clientId: string
  conversationId: number
  body: string
  timestamp: number
  status: OutboxStatus
  error?: string
}

type OutboxState = {
  entries: OutboxEntry[]
  enqueue: (entry: OutboxEntry) => void
  markSending: (clientId: string) => void
  markQueued: (clientId: string) => void
  markFailed: (clientId: string, error: string) => void
  remove: (clientId: string) => void
  clear: () => void
}

/**
 * Messages the user has sent that the server has not confirmed.
 *
 * These deliberately live beside the query cache rather than inside it. The message cache is an
 * infinite query paged newest-first; splicing a provisional row into page zero and taking it out
 * again on failure means reaching into the cache's internal page structure, which breaks the
 * moment paging changes. Keeping them separate and merging at render time is both simpler and
 * the reason a failed message can stay on screen with a retry button instead of vanishing.
 *
 * The clientId doubles as the idempotency key sent to the server, so a retry after a timeout
 * resolves to the same message rather than a duplicate.
 */
export const useOutboxStore = create<OutboxState>()((set) => ({
  entries: [],
  enqueue: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  markSending: (clientId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.clientId === clientId ? { ...entry, status: 'sending', error: undefined } : entry
      ),
    })),
  markQueued: (clientId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.clientId === clientId ? { ...entry, status: 'queued', error: undefined } : entry
      ),
    })),
  markFailed: (clientId, error) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.clientId === clientId ? { ...entry, status: 'failed', error } : entry
      ),
    })),
  remove: (clientId) =>
    set((state) => ({ entries: state.entries.filter((entry) => entry.clientId !== clientId) })),
  clear: () => set({ entries: [] }),
}))
