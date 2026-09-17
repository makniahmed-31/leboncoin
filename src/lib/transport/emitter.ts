import type { TransportEvent } from './types'

export class Emitter {
  private listeners = new Set<(event: TransportEvent) => void>()

  subscribe(listener: (event: TransportEvent) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: TransportEvent) {
    for (const listener of this.listeners) listener(event)
  }

  clear() {
    this.listeners.clear()
  }
}
