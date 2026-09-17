import '@testing-library/jest-dom/vitest'
// Registers toHaveNoViolations and its types in one import.
import 'vitest-axe/extend-expect'

import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { resetThemeForTests } from '@/shared/theme/use-theme'
import { useComposerStore } from '@/stores/composer-store'
import { useOutboxStore } from '@/stores/outbox-store'

import { EventSourceStub, resetEventSources } from './event-source'
import { server } from './msw-server'

beforeAll(() => {
  // Any request the tests did not plan for is a bug in the test, not something to let through to
  // the network and time out on.
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  // Zustand stores are module singletons. Without this, a draft typed in one test is still there
  // in the next one, and the failure shows up somewhere unrelated.
  useComposerStore.setState({ drafts: {} })
  useOutboxStore.setState({ entries: [] })
  // Same reason, for the theme store — and it also owns an attribute on <html>, which jsdom keeps
  // across tests in a file.
  resetThemeForTests()
  resetEventSources()
})

afterAll(() => server.close())

// jsdom ships neither of these, and the message list and the composer both depend on them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

// See event-source.ts: jsdom has no EventSource, and the live transport constructs one on mount.
vi.stubGlobal('EventSource', EventSourceStub)

if (!window.matchMedia) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
