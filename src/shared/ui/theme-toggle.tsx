'use client'

import { THEME_LABELS, THEMES, type Theme } from '@/shared/theme/theme'
import { setTheme, useTheme } from '@/shared/theme/use-theme'
import { MoonIcon, SunIcon, SystemThemeIcon } from '@/shared/ui/icons'
import { cn } from '@/lib/utils'

const ICONS: Record<Theme, (props: { className?: string }) => React.ReactElement> = {
  system: SystemThemeIcon,
  light: SunIcon,
  dark: MoonIcon,
}

/**
 * Three native radios in a fieldset, not a button that cycles through the themes.
 *
 * A cycling button is smaller, and it is the reason theme switches are so often unusable: its
 * accessible name has to describe either the current state or the next one, it never announces
 * which of the three is active, and it makes reaching "system" from "system" a three-press
 * journey. Radios say the whole thing out loud — a named group, three options, one of them
 * checked — and the browser supplies arrow-key navigation, the single tab stop and the grouping
 * semantics for free.
 *
 * The inputs are real radios stretched over the pill and made transparent, rather than clipped
 * into an `sr-only` pixel. Both are invisible; only this one is the thing you click. A clipped
 * input leaves the label as the hit target and the control as a one-pixel box that pointer and
 * automation events have to be forwarded to — which is exactly where a stray `pointer-events` or
 * an overlapping sibling turns into a control nobody can operate. The visual state moves to the
 * sibling span through `peer-checked`, including the focus ring, because the input draws nothing.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme()

  return (
    <fieldset
      className={cn('border-border flex items-center gap-0.5 rounded-full border p-0.5', className)}
    >
      <legend className="sr-only">Theme</legend>

      {THEMES.map((option) => {
        const Icon = ICONS[option]

        return (
          <label key={option} title={THEME_LABELS[option]} className="relative inline-flex">
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => setTheme(option)}
              className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full opacity-0"
            />
            <span
              className={cn(
                'text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                'peer-hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground',
                'peer-focus-visible:outline-ring peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="sr-only">{THEME_LABELS[option]}</span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
