/**
 * The vocabulary of the theme choice, kept free of anything browser-only so the root layout — a
 * server component — can import the colours and the boot script from here too.
 */
export type Theme = 'system' | 'light' | 'dark'

/** Order matters: it is the order of the three controls in the toggle. */
export const THEMES = ['system', 'light', 'dark'] as const satisfies readonly Theme[]

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Systeme',
  light: 'Clair',
  dark: 'Sombre',
}

/**
 * Not prefixed with the drafts key, because the two are unrelated and a shared prefix invites a
 * `clear`-by-prefix that wipes one while meaning the other.
 */
export const THEME_STORAGE_KEY = 'lbc-messaging-theme'

/**
 * The browser-chrome colour for each theme, matching --background in globals.css. It lives here
 * rather than being typed a second time in the viewport export, because the two going out of sync
 * shows up only as a mobile address bar that is the wrong colour — the kind of mismatch nobody
 * reports.
 */
export const THEME_COLORS = { light: '#ffffff', dark: '#0a0a0a' } as const

/** The class shadcn's `dark:` variant keys off. One spelling, shared by the boot script below and
 *  the store that takes over once React is up. */
export const DARK_CLASS = 'dark'

/** Whether a chosen theme resolves to the dark palette right now. "system" is the only value that
 *  has to ask the browser, which is the part a class strategy cannot express in CSS alone. */
export function prefersDark(theme: Theme, matches: boolean): boolean {
  return theme === 'dark' || (theme === 'system' && matches)
}

export const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Runs before first paint, from the root layout, so a reader who chose a theme never sees the
 * other one flash. It is inline and blocking on purpose: a deferred script or an effect both run
 * after the first paint, which is the flash.
 *
 * Under shadcn's class strategy this script has more to do than it used to. "system" is no longer
 * the do-nothing case — with no class on <html> the :root block wins and the page renders light —
 * so the script has to read the media query itself and set the class for system-dark readers too.
 * That is the standing cost of a class-based theme, and it is why it is paid here, before paint,
 * rather than in an effect.
 */
export const THEME_INIT_SCRIPT =
  `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});` +
  `var d=t==="dark"||(t!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches);` +
  `document.documentElement.classList.toggle(${JSON.stringify(DARK_CLASS)},d)}catch(e){}`
