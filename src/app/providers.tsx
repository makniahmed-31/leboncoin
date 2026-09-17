'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { createQueryClient } from '@/lib/query-client'
import { LiveProvider } from '@/shared/live/live-provider'

/**
 * The whole provider tree. There is no ChatProvider and no ConversationProvider: server data
 * lives in the query cache, the open conversation lives in the URL, and the little that is left
 * lives in two Zustand stores. A context holding business state would only add re-renders and a
 * second place for the truth to sit.
 *
 * The query client is created in state rather than at module scope so that concurrent requests on
 * the server cannot share one cache between users.
 */
export function Providers({ children, live }: { children: React.ReactNode; live: boolean }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {/* `live` comes from the server, which is the only side that can read the session cookie.
          Deciding it here rather than inside the provider keeps the rule — no stream without a
          session — in one obvious place. */}
      <LiveProvider enabled={live}>{children}</LiveProvider>
    </QueryClientProvider>
  )
}
