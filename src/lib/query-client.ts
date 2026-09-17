import { QueryClient, isServer } from '@tanstack/react-query'

import { ApiError } from './api-error'

const MAX_RETRIES = 3

/**
 * A blanket `retry: 3` is wrong here and costs real time on a bad connection: a 400 or a 404
 * cannot become a 200 by being asked again, and retrying it three times just delays the error the
 * user needs to see. Only failures that can plausibly resolve on their own are repeated.
 */
function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= MAX_RETRIES) return false
  if (error instanceof ApiError) return error.isRetryable
  // A thrown non-ApiError is almost always a network fault before a response existed.
  return true
}

/**
 * Exponential backoff with jitter. The jitter matters at leboncoin's scale rather than in this
 * test: when an instance comes back up, clients that all failed at the same moment otherwise all
 * retry at the same moment and knock it over again.
 */
function backoff(attempt: number) {
  const base = Math.min(1000 * 2 ** attempt, 15_000)
  return base * (0.5 + Math.random() * 0.5)
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough that navigating back to a list does not refetch it, short enough that a
        // thread left open does not drift. Polling handles genuine freshness.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: backoff,
        refetchOnWindowFocus: true,
        // Server renders get one shot: a retry there delays first paint instead of helping.
        ...(isServer ? { retry: false } : {}),
      },
      mutations: {
        // Sends carry an idempotency key, so a retry cannot duplicate a message.
        retry: shouldRetry,
        retryDelay: backoff,
      },
    },
  })
}
