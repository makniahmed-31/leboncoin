import type { Metadata, Viewport } from 'next'

import { THEME_COLORS, THEME_INIT_SCRIPT } from '@/shared/theme/theme'
import { ConnectionBanner } from '@/shared/ui/connection-banner'

import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Messagerie leboncoin',
  description: 'Consultez et repondez a vos messages.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled. Locking it is a common way to make a mobile layout look tidy and an
  // immediate WCAG failure for anyone who needs to magnify text.
  maximumScale: 5,
  // The system case, which is the default and all the server can know. When the reader has
  // picked a theme the store rewrites both of these to the chosen colour, so whichever one the
  // browser matches is the one actually on screen.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* The boot script below writes shadcn's `dark` class onto this element before React
       hydrates, which is a mismatch by construction — suppressHydrationWarning says so
       deliberately. It covers this element's own attributes only, not the tree inside it. */
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased">
        {/* First thing in the body and blocking, so the stored theme is applied before the first
            paint rather than after it, which is what a flash of the wrong theme actually is. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        <Providers>
          <a
            href="#contenu"
            className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
          >
            Aller au contenu
          </a>
          <ConnectionBanner />
          {children}
        </Providers>
      </body>
    </html>
  )
}
