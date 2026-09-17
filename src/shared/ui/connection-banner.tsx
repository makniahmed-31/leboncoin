'use client'

import { useLive } from '@/shared/live/live-provider'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'

/**
 * Two different failures, told apart because the user can do something about one of them.
 *
 * "No network" is theirs to fix. "Backend unreachable while the network is fine" is ours, and
 * saying so stops people from restarting their router over our outage.
 */
export function ConnectionBanner() {
  const online = useOnlineStatus()
  const { status } = useLive()

  if (online && status !== 'offline') return null

  return (
    // <output> carries role="status" implicitly, so the message is announced politely when it
    // appears without interrupting whatever the user is reading.
    <output className="bg-destructive/10 text-destructive block px-4 py-2 text-center text-sm font-medium">
      {online
        ? 'Connexion au service perdue. Nouvelle tentative en cours.'
        : 'Vous etes hors ligne. Vos messages partiront des le retour du reseau.'}
    </output>
  )
}
