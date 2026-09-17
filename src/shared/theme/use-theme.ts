'use client'

import { useSyncExternalStore } from 'react'

import {
  DARK_CLASS,
  DARK_QUERY,
  prefersDark,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  type Theme,
} from './theme'

/**
 * A module-level store read through useSyncExternalStore rather than a context or a Zustand
 * store.
 *
 * Context is wrong here: the theme is a property of the document, not of a React subtree, and a
 * provider would re-render the whole tree to change something the browser applies through one
 * attribute. useSyncExternalStore is the same shape `useOnlineStatus` uses, and it earns its keep
 * for the same reason — the server snapshot is explicitly "system", which is what the server
 * rendered, so hydration matches and React re-renders with the stored choice on its own.
 *
 * The store is not the source of truth for what is on screen. The `dark` class on <html> is, and
 * the inline script sets it before React exists; this keeps the two in step and tells the controls
 * which one to mark as selected.
 */
const listeners = new Set<() => void>()

/** null until first read, so nothing touches localStorage during a server render. */
let current: Theme | null = null

function readStored(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Safari in private mode throws rather than returning null, and a theme is not worth a crash.
    return 'system'
  }
}

/**
 * Keeps the two <meta name="theme-color"> tags the viewport export renders honest. They are
 * written per colour scheme, which is right while the theme follows the system and wrong the
 * moment somebody overrides it: both then get the chosen colour, so whichever one the browser
 * matches is the one that is actually on screen.
 */
function syncBrowserChrome(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = theme === 'system' ? (meta.media.includes('dark') ? 'dark' : 'light') : theme
    meta.content = THEME_COLORS[scheme]
  }
}

/**
 * shadcn's `dark:` variant matches a class, so "system" has to be resolved to a concrete palette
 * here rather than left to the cascade: there is no class that means "whatever the OS says". The
 * chosen theme stays "system" in the store — it is what the reader picked — and only the class on
 * <html> collapses to one of the two.
 */
/**
 * Held rather than re-created per call. `matchMedia` hands back a new MediaQueryList every time,
 * so a `removeEventListener` on a fresh one unsubscribes from an object nobody listened to and
 * leaves the real listener attached — and a list with no references of its own is free to be
 * collected, at which point it silently stops firing.
 */
let darkQuery: MediaQueryList | null = null

function getDarkQuery(): MediaQueryList {
  darkQuery ??= window.matchMedia(DARK_QUERY)
  return darkQuery
}

function apply(theme: Theme) {
  const dark = prefersDark(theme, getDarkQuery().matches)
  document.documentElement.classList.toggle(DARK_CLASS, dark)

  syncBrowserChrome(theme)
}

function emit() {
  for (const listener of listeners) listener()
}

/** Another tab changed the choice. Storage events only fire in the tabs that did not write. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) return

  current = readStored()
  apply(current)
  emit()
}

/**
 * The OS flipped while the reader is on "system". Under the old color-scheme strategy the browser
 * handled this with no JavaScript at all; a class has to be rewritten by hand.
 */
function onSystemChange() {
  if (getSnapshot() !== 'system') return
  apply('system')
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage)
    getDarkQuery().addEventListener('change', onSystemChange)

    /*
     * Reconcile once on the way in, because there is a window where nothing is listening: the
     * boot script reads the media query before paint, and this runs at hydration. An OS that
     * flips between those two moments fires a `change` nobody hears, and the class is then stale
     * for the life of the page — a reader on "system" left in the wrong palette until they
     * reload. Re-applying here closes that window; it is a no-op in every other case.
     */
    apply(getSnapshot())
  }

  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage)
      getDarkQuery().removeEventListener('change', onSystemChange)
    }
  }
}

function getSnapshot(): Theme {
  current ??= readStored()
  return current
}

export function setTheme(theme: Theme) {
  current = theme

  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The choice still applies to this page; it just will not survive a reload.
  }

  apply(theme)
  emit()
}

/** The chosen theme, which is "system" unless the reader picked otherwise — not what is on screen. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'system')
}

/** Test-only: the store is a module singleton, so it outlives a test the way any singleton does. */
export function resetThemeForTests() {
  current = null
  apply('system')
}
