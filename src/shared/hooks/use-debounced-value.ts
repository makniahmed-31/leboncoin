'use client'

import { useEffect, useState } from 'react'

/**
 * Delays a value until it stops changing.
 *
 * Used by the conversation search: without it every keystroke is a request, so typing eight
 * characters costs eight round trips of which seven are already stale by the time they land.
 * 300 ms is under the threshold at which a pause feels like lag and long enough to collapse
 * ordinary typing into one request.
 *
 * `useDeferredValue` is the React-native alternative and does something different — it keeps the
 * UI responsive while rendering, but does not reduce the number of requests, which is the cost
 * that matters here.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    // Clearing on every change is what makes this a debounce rather than a throttle: the timer
    // restarts while the user is still typing and only fires once they stop.
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
