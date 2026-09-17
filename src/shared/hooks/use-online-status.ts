'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * useSyncExternalStore rather than useState + useEffect: the server snapshot is explicitly
 * "online", so the markup rendered on the server and the first client render agree and the
 * offline banner cannot flash on a hydrating page.
 *
 * navigator.onLine only knows whether the machine has a network interface, not whether the API
 * is reachable. Failed requests are what actually prove the backend is gone, which is why the
 * error states carry their own message rather than deferring to this.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  )
}
